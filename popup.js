// Popup script for VDAB Job Archiver Chrome Extension

document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const olderThanSelect = document.getElementById('olderThan');
  const statusDiv = document.getElementById('status');
  const progressDiv = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  let isRunning = false;

  // Load saved settings
  chrome.storage.sync.get(['olderThan'], function(result) {
    if (result.olderThan) {
      olderThanSelect.value = result.olderThan;
    }
  });

  // Save settings when changed
  olderThanSelect.addEventListener('change', function() {
    chrome.storage.sync.set({
      olderThan: olderThanSelect.value
    });
  });

  startBtn.addEventListener('click', async function() {
    const olderThanMonths = parseInt(olderThanSelect.value);
    
    // Check if we're on the right page
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('vdab.be')) {
      showStatus('Please navigate to the VDAB website first.', 'error');
      return;
    }

    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    progressDiv.style.display = 'block';
    
    showStatus('Starting job archiving process...', 'info');

    try {
      // Send message to content script to start the process
      chrome.tabs.sendMessage(tab.id, {
        action: 'startArchiving',
        olderThanMonths: olderThanMonths
      }, function(response) {
        if (chrome.runtime.lastError) {
          showStatus('Error: Make sure you\'re on the VDAB job applications page.', 'error');
          resetUI();
          return;
        }
        
        if (response && response.success) {
          showStatus('Process started successfully.', 'success');
        } else {
          showStatus(response?.error || 'Failed to start process.', 'error');
          resetUI();
        }
      });
    } catch (error) {
      showStatus('Error starting process: ' + error.message, 'error');
      resetUI();
    }
  });

  stopBtn.addEventListener('click', async function() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'stopArchiving'
    });
    
    showStatus('Stopping process...', 'info');
    resetUI();
  });

  // Listen for progress updates
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateProgress') {
      updateProgress(request.current, request.total, request.message);
    } else if (request.action === 'processComplete') {
      showStatus(request.message, 'success');
      resetUI();
    } else if (request.action === 'processError') {
      showStatus(request.error, 'error');
      resetUI();
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }

  function updateProgress(current, total, message) {
    const percentage = total > 0 ? (current / total) * 100 : 0;
    progressFill.style.width = percentage + '%';
    progressText.textContent = message || `Processing ${current} of ${total}`;
  }

  function resetUI() {
    isRunning = false;
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    progressDiv.style.display = 'none';
    progressFill.style.width = '0%';
  }
});
