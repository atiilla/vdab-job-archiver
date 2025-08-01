// Content script for VDAB Job Archiver Chrome Extension

class VDABJobArchiver {
  constructor() {
    this.isRunning = false;
    this.shouldStop = false;
    this.BASE_URL = "https://www.vdab.be/rest/vindeenjob/v4/sollicitaties/page";
    this.WERKZOEKENDE_ID = null; // Will be extracted dynamically
    this.PAGE_SIZE = 150;
    
    // Set up network request monitoring to capture WERKZOEKENDE_ID
    this.setupNetworkMonitoring();
  }

  setupNetworkMonitoring() {
    // Override fetch to intercept requests
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = function(...args) {
      const url = args[0];
      if (typeof url === 'string' && url.includes('ikl=')) {
        const match = url.match(/ikl=(\d+)/);
        if (match && match[1]) {
          self.WERKZOEKENDE_ID = match[1];
          console.log('Captured WERKZOEKENDE_ID from fetch request:', match[1]);
        }
      }
      return originalFetch.apply(this, args);
    };

    // Override XMLHttpRequest to intercept requests
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      if (typeof url === 'string' && url.includes('ikl=')) {
        const match = url.match(/ikl=(\d+)/);
        if (match && match[1]) {
          self.WERKZOEKENDE_ID = match[1];
          console.log('Captured WERKZOEKENDE_ID from XHR request:', match[1]);
        }
      }
      return originalXHROpen.apply(this, arguments);
    };
  }

  // Extract headers from current page context
  getHeaders() {
    const cookies = document.cookie;
    const xsrfToken = this.extractXSRFToken();
    
    return {
      "accept": "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.5",
      "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "sec-gpc": "1",
      "vej-key-monitor": "b277002f-e1fa-4fc5-868a-fdab633c3851",
      "Referer": "https://www.vdab.be/vindeenjob/prive/bewaarde-vacatures-en-sollicitaties"
    };
  }

  extractXSRFToken() {
    // Try to extract XSRF token from cookies or meta tags
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'XSRF-TOKEN') {
        return value;
      }
    }
    
    // Try to find it in meta tags
    const metaToken = document.querySelector('meta[name="_token"]');
    if (metaToken) {
      return metaToken.getAttribute('content');
    }
    
    return ""; // Fallback if not found
  }

  extractWerkzoekendeId() {
    // Method 1: Check URL parameters (ikl parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const iklFromUrl = urlParams.get('ikl');
    if (iklFromUrl) {
      console.log('Found WERKZOEKENDE_ID in URL parameters:', iklFromUrl);
      return iklFromUrl;
    }

    // Method 2: Check current page URL path for ID patterns
    const pathMatch = window.location.pathname.match(/\/(\d{8,})/);
    if (pathMatch) {
      console.log('Found WERKZOEKENDE_ID in URL path:', pathMatch[1]);
      return pathMatch[1];
    }

    // Method 3: Listen for network requests to extract ikl parameter
    const networkExtractedId = this.extractFromNetworkRequests();
    if (networkExtractedId) {
      console.log('Found WERKZOEKENDE_ID from network requests:', networkExtractedId);
      return networkExtractedId;
    }

    // Method 4: Try to extract from page content/scripts
    const scriptTags = document.querySelectorAll('script');
    for (let script of scriptTags) {
      const content = script.textContent;
      
      // Look for various patterns where the ID might be stored
      const patterns = [
        /werkzoekendeId['":\s]*["']?(\d+)["']?/i,
        /ikl['":\s]*["']?(\d+)["']?/i,
        /userId['":\s]*["']?(\d+)["']?/i,
        /"ikl":\s*"?(\d+)"?/i,
        /pagina=\d+&ikl=(\d+)/i
      ];
      
      for (let pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1] && match[1].length >= 8) {
          console.log('Found WERKZOEKENDE_ID in script content:', match[1]);
          return match[1];
        }
      }
    }

    // Method 5: Check localStorage and sessionStorage
    const storageId = this.extractFromStorage();
    if (storageId) {
      console.log('Found WERKZOEKENDE_ID in storage:', storageId);
      return storageId;
    }

    // Method 6: Try to extract from cookies
    const cookieId = this.extractFromCookies();
    if (cookieId) {
      console.log('Found WERKZOEKENDE_ID in cookies:', cookieId);
      return cookieId;
    }

    console.warn('Could not extract WERKZOEKENDE_ID dynamically, please check the page');
    return null;
  }

  extractFromNetworkRequests() {
    // This method will be enhanced with a network listener
    // For now, try to find existing requests in the page
    try {
      const performanceEntries = performance.getEntries();
      for (let entry of performanceEntries) {
        if (entry.name && entry.name.includes('ikl=')) {
          const match = entry.name.match(/ikl=(\d+)/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    } catch (error) {
      console.warn('Could not extract from network requests:', error);
    }
    return null;
  }

  extractFromStorage() {
    try {
      // Check localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        
        if (key && (key.toLowerCase().includes('werkzoekende') || key.toLowerCase().includes('user'))) {
          const match = value.match(/\d{8,}/);
          if (match) return match[0];
        }
        
        if (value && value.includes('ikl')) {
          const match = value.match(/ikl['":\s]*["']?(\d+)["']?/i);
          if (match) return match[1];
        }
      }

      // Check sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        const value = sessionStorage.getItem(key);
        
        if (key && (key.toLowerCase().includes('werkzoekende') || key.toLowerCase().includes('user'))) {
          const match = value.match(/\d{8,}/);
          if (match) return match[0];
        }
        
        if (value && value.includes('ikl')) {
          const match = value.match(/ikl['":\s]*["']?(\d+)["']?/i);
          if (match) return match[1];
        }
      }
    } catch (error) {
      console.warn('Could not extract from storage:', error);
    }
    return null;
  }

  extractFromCookies() {
    try {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name && (name.toLowerCase().includes('werkzoekende') || name.toLowerCase().includes('user'))) {
          const match = value.match(/\d{8,}/);
          if (match) return match[0];
        }
        if (value && value.includes('ikl')) {
          const match = value.match(/ikl.*?(\d+)/);
          if (match) return match[1];
        }
      }
    } catch (error) {
      console.warn('Could not extract from cookies:', error);
    }
    return null;
  }

  async fetchAppliedJobsPage(pageNumber) {
    let werkzoekendeId = this.WERKZOEKENDE_ID || this.extractWerkzoekendeId();
    
    if (!werkzoekendeId) {
      throw new Error('Could not extract WERKZOEKENDE_ID. Please make sure you are on the VDAB job applications page and that the page has loaded completely.');
    }
    
    // Cache the extracted ID for future use
    this.WERKZOEKENDE_ID = werkzoekendeId;
    
    const url = `${this.BASE_URL}?actief=true&werkzoekendeRol=KLANT&pageNumber=${pageNumber}&listSize=${this.PAGE_SIZE}&werkzoekendeId=${werkzoekendeId}&pageSize=${this.PAGE_SIZE}`;
    
    console.log(`Fetching page ${pageNumber} with WERKZOEKENDE_ID: ${werkzoekendeId}`);
    
    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
        method: "GET",
        credentials: 'same-origin'
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication error (${response.status}). Please refresh the page and try again.`);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching page ${pageNumber}:`, error);
      throw error;
    }
  }

  async archiveAppliedJob(jobId) {
    const url = `https://www.vdab.be/api/vindeenjob/prive/sollicitaties/${jobId}/archiveer`;
    const xsrfToken = this.extractXSRFToken();

    try {
      const response = await fetch(url, {
        headers: {
          ...this.getHeaders(),
          "content-type": "application/json",
          "x-xsrf-token": xsrfToken
        },
        method: "PUT",
        body: jobId.toString(),
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`Failed to archive job ${jobId}: HTTP status ${response.status}`);
      }

      console.log(`Job ${jobId} archived successfully`);
      return true;
    } catch (error) {
      console.error(`Error archiving job ${jobId}:`, error);
      return false;
    }
  }

  // Test method to validate if we can extract the WERKZOEKENDE_ID
  async testWerkzoekendeIdExtraction() {
    const id = this.WERKZOEKENDE_ID || this.extractWerkzoekendeId();
    
    if (!id) {
      console.error('❌ Could not extract WERKZOEKENDE_ID');
      return false;
    }
    
    console.log('✅ Successfully extracted WERKZOEKENDE_ID:', id);
    
    // Test if we can make a request with this ID
    try {
      const testUrl = `https://www.vdab.be/rest/vindeenjob/v4/bewaardeVacatures?pagina=0&ikl=${id}&paginaGrootte=1`;
      const response = await fetch(testUrl, {
        headers: this.getHeaders(),
        method: "GET",
        credentials: 'same-origin'
      });
      
      if (response.ok) {
        console.log('✅ WERKZOEKENDE_ID validation successful - can make API requests');
        this.WERKZOEKENDE_ID = id; // Cache the working ID
        return true;
      } else {
        console.warn('⚠️ WERKZOEKENDE_ID extracted but API request failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Error validating WERKZOEKENDE_ID:', error);
      return false;
    }
  }

  async startArchiving(olderThanMonths) {
    if (this.isRunning) return;
    
    // First, try to extract and validate the WERKZOEKENDE_ID
    const idValid = await this.testWerkzoekendeIdExtraction();
    if (!idValid) {
      chrome.runtime.sendMessage({
        action: 'processError',
        error: 'Could not extract or validate WERKZOEKENDE_ID. Please make sure you are on the correct VDAB page and try again.'
      });
      return;
    }
    
    this.isRunning = true;
    this.shouldStop = false;

    try {
      let totalJobsCount = 0;
      let oldJobsCount = 0;
      let archivedCount = 0;
      let currentPage = 0;
      let totalPages = null;

      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - olderThanMonths);

      while ((totalPages === null || currentPage < totalPages) && !this.shouldStop) {
        try {
          // Send progress update
          chrome.runtime.sendMessage({
            action: 'updateProgress',
            current: currentPage,
            total: totalPages || 1,
            message: `Processing page ${currentPage + 1}${totalPages ? ` of ${totalPages}` : ''}...`
          });

          const pageData = await this.fetchAppliedJobsPage(currentPage);
          
          // Set total pages from first response
          if (totalPages === null) {
            totalPages = pageData.aantalPaginas || 1;
            console.log(`Total pages to process: ${totalPages}`);
          }
          
          if (pageData.results && pageData.results.length > 0) {
            const pageJobsCount = pageData.results.length;
            totalJobsCount += pageJobsCount;
            
            // Filter jobs older than specified months
            const pageOldJobs = pageData.results.filter(job => {
              const dateToCheck = job.laatsteWijzigingDatum || 
                                 job.huidigeActiviteit?.aanmaakTijdstip ||
                                 job.huidigeActiviteit?.sollicitatieActiviteitCode?.uitvoeringsTijdstip;

              if (!dateToCheck) {
                return false;
              }

              const jobDate = new Date(dateToCheck);
              return jobDate < cutoffDate;
            });

            oldJobsCount += pageOldJobs.length;

            // Archive old jobs
            for (const job of pageOldJobs) {
              if (this.shouldStop) break;
              
              const success = await this.archiveAppliedJob(job.id);
              if (success) {
                archivedCount++;
              }
              
              // Small delay to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            currentPage++;
          } else {
            break;
          }
        } catch (error) {
          console.error(`Failed to fetch page ${currentPage}:`, error);
          chrome.runtime.sendMessage({
            action: 'processError',
            error: `Error processing page ${currentPage}: ${error.message}`
          });
          break;
        }
      }

      const message = this.shouldStop 
        ? `Process stopped. Processed ${totalJobsCount} jobs, found ${oldJobsCount} old jobs, archived ${archivedCount}.`
        : `Process completed! Processed ${totalJobsCount} jobs, found ${oldJobsCount} old jobs, archived ${archivedCount}.`;

      chrome.runtime.sendMessage({
        action: 'processComplete',
        message: message
      });

    } catch (error) {
      chrome.runtime.sendMessage({
        action: 'processError',
        error: error.message
      });
    } finally {
      this.isRunning = false;
      this.shouldStop = false;
    }
  }

  stopArchiving() {
    this.shouldStop = true;
  }
}

// Initialize the archiver
const archiver = new VDABJobArchiver();

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startArchiving') {
    // Check if we're on the right page
    if (!window.location.href.includes('vdab.be')) {
      sendResponse({ success: false, error: 'Not on VDAB website' });
      return;
    }

    archiver.startArchiving(request.olderThanMonths);
    sendResponse({ success: true });
  } else if (request.action === 'stopArchiving') {
    archiver.stopArchiving();
    sendResponse({ success: true });
  } else if (request.action === 'testIdExtraction') {
    // New action to test ID extraction
    archiver.testWerkzoekendeIdExtraction().then(result => {
      sendResponse({ success: result, id: archiver.WERKZOEKENDE_ID });
    });
    return true; // Keep the message channel open for async response
  } else if (request.action === 'getCurrentId') {
    // Get the current extracted ID
    const id = archiver.WERKZOEKENDE_ID || archiver.extractWerkzoekendeId();
    sendResponse({ success: !!id, id: id });
  }
});

console.log('VDAB Job Archiver content script loaded');

// Try to extract WERKZOEKENDE_ID immediately when the script loads
setTimeout(() => {
  const id = archiver.extractWerkzoekendeId();
  if (id) {
    console.log('Auto-extracted WERKZOEKENDE_ID on page load:', id);
  } else {
    console.log('Could not auto-extract WERKZOEKENDE_ID on page load - will try during network requests');
  }
}, 2000); // Wait 2 seconds for page to fully load
