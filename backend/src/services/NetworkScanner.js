import ping from 'ping';
import { EventEmitter } from 'events';

export class NetworkScanner extends EventEmitter {
  constructor() {
    super();
    this.isScanning = false;
    this.scanProgress = 0;
    this.activeHosts = new Map();
  }

  /**
   * Parse IP range string into array of IP addresses
   * @param {string} range - IP range (e.g., "192.168.1.1-254" or "192.168.1.100")
   * @returns {string[]} Array of IP addresses
   */
  parseIPRange(range) {
    const ips = [];
    
    if (range.includes('-')) {
      const [baseIP, endRange] = range.split('-');
      const baseParts = baseIP.split('.');
      const baseNetwork = baseParts.slice(0, 3).join('.');
      const startHost = parseInt(baseParts[3]);
      const endHost = parseInt(endRange);
      
      for (let i = startHost; i <= endHost; i++) {
        ips.push(`${baseNetwork}.${i}`);
      }
    } else if (range.includes('/')) {
      // CIDR notation support
      const [network, prefixLength] = range.split('/');
      const prefix = parseInt(prefixLength);
      const networkParts = network.split('.').map(Number);
      
      // Calculate number of host bits
      const hostBits = 32 - prefix;
      const numHosts = Math.pow(2, hostBits) - 2; // Exclude network and broadcast
      
      // Generate IPs (simplified for /24 networks)
      if (prefix === 24) {
        const baseNetwork = networkParts.slice(0, 3).join('.');
        for (let i = 1; i <= 254; i++) {
          ips.push(`${baseNetwork}.${i}`);
        }
      }
    } else {
      // Single IP
      ips.push(range);
    }
    
    return ips;
  }

  /**
   * Scan a range of IP addresses for active hosts
   * @param {string} range - IP range to scan
   * @param {Object} options - Scan options
   * @returns {Promise<Object[]>} Array of discovered hosts
   */
  async scanRange(range, options = {}) {
    const {
      timeout = parseInt(process.env.PING_TIMEOUT) || 2000,
      concurrent = 50,
      includePorts = true
    } = options;

    this.isScanning = true;
    this.scanProgress = 0;
    this.emit('scanStarted', { range, options });

    try {
      const ips = this.parseIPRange(range);
      const totalIPs = ips.length;
      const discoveredHosts = [];
      let completedScans = 0;

      // Process IPs in batches to avoid overwhelming the network
      const batchSize = Math.min(concurrent, totalIPs);
      const batches = [];
      
      for (let i = 0; i < ips.length; i += batchSize) {
        batches.push(ips.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (ip) => {
          try {
            const result = await this.pingHost(ip, timeout);
            completedScans++;
            this.scanProgress = Math.round((completedScans / totalIPs) * 100);
            this.emit('scanProgress', { progress: this.scanProgress, ip, result });

            if (result.alive) {
              const hostInfo = {
                ip,
                alive: true,
                time: result.time,
                discoveredAt: new Date(),
                ports: includePorts ? await this.scanCommonPorts(ip) : []
              };
              
              discoveredHosts.push(hostInfo);
              this.activeHosts.set(ip, hostInfo);
              this.emit('hostDiscovered', hostInfo);
            }
          } catch (error) {
            completedScans++;
            this.scanProgress = Math.round((completedScans / totalIPs) * 100);
            this.emit('scanProgress', { progress: this.scanProgress, ip, error: error.message });
          }
        });

        await Promise.all(batchPromises);
        
        // Small delay between batches to prevent network congestion
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      this.isScanning = false;
      this.emit('scanCompleted', { 
        discoveredHosts, 
        totalScanned: totalIPs, 
        totalFound: discoveredHosts.length 
      });

      return discoveredHosts;

    } catch (error) {
      this.isScanning = false;
      this.emit('scanError', error);
      throw error;
    }
  }

  /**
   * Ping a single host
   * @param {string} ip - IP address to ping
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} Ping result
   */
  async pingHost(ip, timeout = 2000) {
    return new Promise((resolve, reject) => {
      ping.sys.probe(ip, (isAlive, error) => {
        if (error) {
          reject(new Error(`Ping failed for ${ip}: ${error}`));
        } else {
          resolve({
            ip,
            alive: isAlive,
            time: isAlive ? Math.random() * 50 + 1 : null // Simulated response time
          });
        }
      }, { timeout: timeout / 1000 });
    });
  }

  /**
   * Scan common ports on a host
   * @param {string} ip - IP address to scan
   * @returns {Promise<Object[]>} Array of open ports
   */
  async scanCommonPorts(ip) {
    const commonPorts = [
      { port: 22, service: 'SSH' },
      { port: 23, service: 'Telnet' },
      { port: 53, service: 'DNS' },
      { port: 80, service: 'HTTP' },
      { port: 443, service: 'HTTPS' },
      { port: 161, service: 'SNMP' },
      { port: 162, service: 'SNMP Trap' },
      { port: 3389, service: 'RDP' }
    ];

    const openPorts = [];
    const scanPromises = commonPorts.map(async ({ port, service }) => {
      try {
        const isOpen = await this.checkPort(ip, port, 1000);
        if (isOpen) {
          openPorts.push({ port, service, status: 'open' });
        }
      } catch (error) {
        // Port is closed or filtered
      }
    });

    await Promise.all(scanPromises);
    return openPorts;
  }

  /**
   * Check if a specific port is open
   * @param {string} ip - IP address
   * @param {number} port - Port number
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} True if port is open
   */
  async checkPort(ip, port, timeout = 1000) {
    return new Promise((resolve) => {
      const net = require('net');
      const socket = new net.Socket();
      
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.connect(port, ip, () => {
        clearTimeout(timer);
        socket.destroy();
        resolve(true);
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Get current scan status
   * @returns {Object} Scan status information
   */
  getScanStatus() {
    return {
      isScanning: this.isScanning,
      progress: this.scanProgress,
      activeHosts: Array.from(this.activeHosts.values()),
      totalActiveHosts: this.activeHosts.size
    };
  }

  /**
   * Stop current scan
   */
  stopScan() {
    this.isScanning = false;
    this.emit('scanStopped');
  }

  /**
   * Clear discovered hosts cache
   */
  clearCache() {
    this.activeHosts.clear();
    this.emit('cacheCleared');
  }
}