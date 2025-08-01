// Background script for VDAB Job Archiver Chrome Extension

chrome.runtime.onInstalled.addListener(function() {
  console.log('VDAB Job Archiver extension installed');
  
  // Create context menu item only if contextMenus API is available
  if (chrome.contextMenus) {
    try {
      chrome.contextMenus.create({
        id: "archiveOldJobs",
        title: "Archive old job applications",
        contexts: ["page"],
        documentUrlPatterns: ["https://www.vdab.be/*"]
      });
      console.log('Context menu created successfully');
    } catch (error) {
      console.error('Error creating context menu:', error);
    }
  }
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request);
  
  // Forward progress messages to popup if it's open
  if (request.action === 'updateProgress' || 
      request.action === 'processComplete' || 
      request.action === 'processError') {
    
    // Try to send to popup (it may not be open)
    chrome.runtime.sendMessage(request).catch(() => {
      // Popup not open, ignore error
      console.log('Popup not open, message not forwarded');
    });
  }
  
  // Send response to acknowledge message received
  if (sendResponse) {
    sendResponse({ received: true });
  }
});

// Handle context menu clicks
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener(function(info, tab) {
    console.log('Context menu clicked:', info.menuItemId);
    
    if (info.menuItemId === "archiveOldJobs") {
      // Send message to content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'startArchiving',
        olderThanMonths: 1 // Default to 1 month
      }).then(response => {
        console.log('Message sent to content script:', response);
      }).catch(error => {
        console.error('Error sending message to content script:', error);
      });
    }
  });
}

console.log('VDAB Job Archiver background script loaded successfully');
