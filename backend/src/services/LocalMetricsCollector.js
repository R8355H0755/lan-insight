import os from 'os';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class LocalMetricsCollector {
  constructor(logger) {
    this.logger = logger;
    this.isWindows = os.platform() === 'win32';
    this.isLinux = os.platform() === 'linux';
    this.isMacOS = os.platform() === 'darwin';
  }

  async collectAllMetrics() {
    try {
      const [
        cpuUsage,
        memoryUsage,
        diskUsage,
        systemInfo,
        networkInterfaces
      ] = await Promise.all([
        this.getCPUUsage(),
        this.getMemoryUsage(),
        this.getDiskUsage(),
        this.getSystemInfo(),
        this.getNetworkInterfaces()
      ]);

      return {
        timestamp: new Date().toISOString(),
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        system: systemInfo,
        network: networkInterfaces
      };
    } catch (error) {
      this.logger.error('Failed to collect local metrics:', error);
      throw error;
    }
  }

  async getCPUUsage() {
    try {
      if (this.isWindows) {
        return await this.getWindowsCPUUsage();
      } else if (this.isLinux) {
        return await this.getLinuxCPUUsage();
      } else if (this.isMacOS) {
        return await this.getMacOSCPUUsage();
      }
      
      // Fallback to Node.js method
      return await this.getNodeJSCPUUsage();
    } catch (error) {
      this.logger.warn('Failed to get CPU usage, using fallback:', error.message);
      return await this.getNodeJSCPUUsage();
    }
  }

  async getWindowsCPUUsage() {
    try {
      // Use PowerShell method first as it's more reliable
      const { stdout: psOutput } = await execAsync(
        'powershell "Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average"'
      );
      const cpuUsage = parseFloat(psOutput.trim());
      if (!isNaN(cpuUsage)) {
        return Math.round(cpuUsage);
      }
      
      // Fallback to wmic
      const { stdout } = await execAsync('wmic cpu get loadpercentage /value');
      const match = stdout.match(/LoadPercentage=(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
      
      throw new Error('Could not parse CPU usage from Windows commands');
    } catch (error) {
      throw new Error(`Windows CPU usage collection failed: ${error.message}`);
    }
  }

  async getLinuxCPUUsage() {
    try {
      // Read /proc/stat twice with a small delay to calculate usage
      const stat1 = await fs.readFile('/proc/stat', 'utf8');
      await new Promise(resolve => setTimeout(resolve, 100));
      const stat2 = await fs.readFile('/proc/stat', 'utf8');

      const getCpuTimes = (statData) => {
        const line = statData.split('\n')[0];
        const times = line.split(/\s+/).slice(1).map(Number);
        return {
          idle: times[3],
          total: times.reduce((a, b) => a + b, 0)
        };
      };

      const times1 = getCpuTimes(stat1);
      const times2 = getCpuTimes(stat2);

      const idleDiff = times2.idle - times1.idle;
      const totalDiff = times2.total - times1.total;

      return Math.round(100 - (idleDiff / totalDiff) * 100);
    } catch (error) {
      throw new Error(`Linux CPU usage collection failed: ${error.message}`);
    }
  }

  async getMacOSCPUUsage() {
    try {
      const { stdout } = await execAsync('top -l 1 -n 0 | grep "CPU usage"');
      const match = stdout.match(/(\d+\.\d+)% user/);
      if (match) {
        return Math.round(parseFloat(match[1]));
      }
      throw new Error('Could not parse macOS CPU usage');
    } catch (error) {
      throw new Error(`macOS CPU usage collection failed: ${error.message}`);
    }
  }

  async getNodeJSCPUUsage() {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      const startTime = process.hrtime();

      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const currentTime = process.hrtime(startTime);
        
        const totalTime = currentTime[0] * 1000000 + currentTime[1] / 1000;
        const cpuTime = currentUsage.user + currentUsage.system;
        const cpuPercent = (cpuTime / totalTime) * 100;
        
        resolve(Math.round(cpuPercent));
      }, 100);
    });
  }

  async getMemoryUsage() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      
      return {
        total: Math.round(totalMem / 1024 / 1024), // MB
        used: Math.round(usedMem / 1024 / 1024), // MB
        free: Math.round(freeMem / 1024 / 1024), // MB
        percentage: Math.round((usedMem / totalMem) * 100)
      };
    } catch (error) {
      this.logger.error('Failed to get memory usage:', error);
      return { total: 0, used: 0, free: 0, percentage: 0 };
    }
  }

  async getDiskUsage() {
    try {
      if (this.isWindows) {
        return await this.getWindowsDiskUsage();
      } else if (this.isLinux || this.isMacOS) {
        return await this.getUnixDiskUsage();
      }
      
      return { total: 0, used: 0, free: 0, percentage: 0 };
    } catch (error) {
      this.logger.warn('Failed to get disk usage:', error.message);
      return { total: 0, used: 0, free: 0, percentage: 0 };
    }
  }

  async getWindowsDiskUsage() {
    try {
      // Use PowerShell for more reliable disk usage collection
      const { stdout } = await execAsync(
        'powershell "Get-WmiObject -Class Win32_LogicalDisk | Where-Object {$_.Size -gt 0} | ForEach-Object { [PSCustomObject]@{ Size = $_.Size; FreeSpace = $_.FreeSpace } } | ConvertTo-Json"'
      );
      
      let disks;
      try {
        disks = JSON.parse(stdout.trim());
        if (!Array.isArray(disks)) {
          disks = [disks];
        }
      } catch (parseError) {
        // Fallback to wmic method
        return await this.getWindowsDiskUsageWmic();
      }
      
      let totalSize = 0;
      let totalFree = 0;
      
      for (const disk of disks) {
        totalSize += parseInt(disk.Size);
        totalFree += parseInt(disk.FreeSpace);
      }
      
      const totalUsed = totalSize - totalFree;
      
      return {
        total: Math.round(totalSize / 1024 / 1024 / 1024), // GB
        used: Math.round(totalUsed / 1024 / 1024 / 1024), // GB
        free: Math.round(totalFree / 1024 / 1024 / 1024), // GB
        percentage: totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0
      };
    } catch (error) {
      throw new Error(`Windows disk usage collection failed: ${error.message}`);
    }
  }

  async getWindowsDiskUsageWmic() {
    try {
      const { stdout } = await execAsync('wmic logicaldisk where size!=0 get size,freespace,caption /value');
      const lines = stdout.split('\n').filter(line => line.trim());
      
      let totalSize = 0;
      let totalFree = 0;
      
      for (const line of lines) {
        if (line.includes('Size=')) {
          const size = parseInt(line.split('=')[1]);
          if (!isNaN(size)) totalSize += size;
        } else if (line.includes('FreeSpace=')) {
          const free = parseInt(line.split('=')[1]);
          if (!isNaN(free)) totalFree += free;
        }
      }
      
      const totalUsed = totalSize - totalFree;
      
      return {
        total: Math.round(totalSize / 1024 / 1024 / 1024), // GB
        used: Math.round(totalUsed / 1024 / 1024 / 1024), // GB
        free: Math.round(totalFree / 1024 / 1024 / 1024), // GB
        percentage: totalSize > 0 ? Math.round((totalUsed / totalSize) * 100) : 0
      };
    } catch (error) {
      throw new Error(`Windows wmic disk usage collection failed: ${error.message}`);
    }
  }

  async getUnixDiskUsage() {
    try {
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      
      if (parts.length >= 5) {
        const total = this.parseSize(parts[1]);
        const used = this.parseSize(parts[2]);
        const free = this.parseSize(parts[3]);
        const percentage = parseInt(parts[4].replace('%', ''));
        
        return {
          total: Math.round(total / 1024), // GB
          used: Math.round(used / 1024), // GB
          free: Math.round(free / 1024), // GB
          percentage: percentage || 0
        };
      }
      
      throw new Error('Could not parse df output');
    } catch (error) {
      throw new Error(`Unix disk usage collection failed: ${error.message}`);
    }
  }

  parseSize(sizeStr) {
    const size = parseFloat(sizeStr);
    const unit = sizeStr.slice(-1).toUpperCase();
    
    switch (unit) {
      case 'K': return size;
      case 'M': return size * 1024;
      case 'G': return size * 1024 * 1024;
      case 'T': return size * 1024 * 1024 * 1024;
      default: return size / 1024; // Assume bytes, convert to KB
    }
  }

  async getSystemInfo() {
    try {
      const networkInterfaces = os.networkInterfaces();
      const primaryInterface = this.getPrimaryNetworkInterface(networkInterfaces);
      
      return {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        uptime: Math.floor(os.uptime()),
        loadavg: os.loadavg(),
        cpus: os.cpus().length,
        nodeVersion: process.version,
        primaryIP: primaryInterface?.address || 'localhost',
        totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to get system info:', error);
      return {
        hostname: 'localhost',
        platform: os.platform(),
        arch: os.arch(),
        uptime: Math.floor(os.uptime()),
        primaryIP: 'localhost',
        timestamp: new Date().toISOString()
      };
    }
  }

  getPrimaryNetworkInterface(interfaces) {
    // Find the primary network interface (non-loopback, IPv4)
    for (const [name, addrs] of Object.entries(interfaces)) {
      if (name.toLowerCase().includes('loopback') || name.toLowerCase().includes('lo')) {
        continue;
      }
      
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return { name, ...addr };
        }
      }
    }
    
    return null;
  }

  async getNetworkInterfaces() {
    try {
      const interfaces = os.networkInterfaces();
      const result = {};
      
      for (const [name, addrs] of Object.entries(interfaces)) {
        result[name] = addrs.map(addr => ({
          address: addr.address,
          netmask: addr.netmask,
          family: addr.family,
          mac: addr.mac,
          internal: addr.internal,
          cidr: addr.cidr
        }));
      }
      
      return result;
    } catch (error) {
      this.logger.error('Failed to get network interfaces:', error);
      return {};
    }
  }

  async getProcessInfo() {
    try {
      return {
        pid: process.pid,
        ppid: process.ppid,
        memory: process.memoryUsage(),
        uptime: Math.floor(process.uptime()),
        version: process.version,
        versions: process.versions,
        arch: process.arch,
        platform: process.platform,
        execPath: process.execPath,
        argv: process.argv,
        env: {
          NODE_ENV: process.env.NODE_ENV,
          PATH: process.env.PATH?.substring(0, 100) + '...' // Truncate for security
        }
      };
    } catch (error) {
      this.logger.error('Failed to get process info:', error);
      return {};
    }
  }

  // Get real-time metrics for dashboard
  async getRealTimeMetrics() {
    try {
      const [cpu, memory, disk] = await Promise.all([
        this.getCPUUsage(),
        this.getMemoryUsage(),
        this.getDiskUsage()
      ]);

      return {
        timestamp: new Date().toISOString(),
        cpu: cpu,
        memory: memory.percentage,
        disk: disk.percentage,
        uptime: Math.floor(os.uptime())
      };
    } catch (error) {
      this.logger.error('Failed to get real-time metrics:', error);
      return {
        timestamp: new Date().toISOString(),
        cpu: 0,
        memory: 0,
        disk: 0,
        uptime: Math.floor(os.uptime())
      };
    }
  }

  // Create a localhost device entry
  createLocalhostDevice() {
    const networkInterfaces = os.networkInterfaces();
    const primaryInterface = this.getPrimaryNetworkInterface(networkInterfaces);
    
    return {
      id: 'localhost',
      ip: primaryInterface?.address || '127.0.0.1',
      hostname: os.hostname(),
      status: 'online',
      community: 'local',
      description: 'Local system metrics',
      location: 'Local Machine',
      contact: 'System Administrator',
      isLocal: true,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };
  }
}

export default LocalMetricsCollector;