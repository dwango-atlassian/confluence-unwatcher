document.addEventListener('DOMContentLoaded', function() {
  const unwatchButton = document.getElementById('unwatchButton');
  const statusDiv = document.getElementById('status');
  
  function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
  }
  
  function hideStatus() {
    statusDiv.style.display = 'none';
  }
  
  function setButtonLoading(loading) {
    if (loading) {
      unwatchButton.innerHTML = '<span class="loading"></span>⚙️ 処理中...';
      unwatchButton.disabled = true;
    } else {
      unwatchButton.innerHTML = '🎯 ウォッチ解除を開始';
      unwatchButton.disabled = false;
    }
  }
  
  unwatchButton.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('atlassian.net') && !tab.url.includes('confluence')) {
        showStatus('❌ Confluenceのページで実行してください', 'error');
        return;
      }
      
      setButtonLoading(true);
      showStatus('🚀 ウォッチ解除処理を開始します...', 'info');
      
      chrome.tabs.sendMessage(tab.id, { action: 'unwatchAll' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          showStatus('⚠️ エラーが発生しました。ページを更新して再試行してください。', 'error');
          setButtonLoading(false);
          return;
        }
        
        if (response && response.success) {
          showStatus('✨ 処理を開始しました。完了まで暫くお待ちください。', 'success');
          
          const checkStatus = setInterval(() => {
            chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, function(statusResponse) {
              if (chrome.runtime.lastError) {
                // Connection lost - stop checking
                clearInterval(checkStatus);
                setButtonLoading(false);
                showStatus('📋 処理が完了しているはずです。結果を確認してください。', 'info');
                return;
              }
              if (statusResponse) {
                if (!statusResponse.isRunning && statusResponse.totalUnwatched > 0) {
                  showStatus(`🎉 完了！${statusResponse.totalUnwatched}個のウォッチを解除しました`, 'success');
                  setButtonLoading(false);
                  clearInterval(checkStatus);
                } else if (statusResponse.isRunning) {
                  showStatus(`⏳ 処理中... (ページ ${statusResponse.currentPage}, ${statusResponse.totalUnwatched}個解除済み)`, 'info');
                }
              }
            });
          }, 2000);
          
          setTimeout(() => {
            clearInterval(checkStatus);
            if (unwatchButton.disabled) {
              setButtonLoading(false);
              showStatus('📋 処理が完了しているはずです。結果を確認してください。', 'info');
            }
          }, 300000); // 5分でタイムアウト
          
        } else {
          showStatus('❌ 処理の開始に失敗しました', 'error');
          setButtonLoading(false);
        }
      });
      
    } catch (error) {
      console.error('Error:', error.message || error);
      showStatus('❌ エラーが発生しました', 'error');
      setButtonLoading(false);
    }
  });
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const currentTab = tabs[0];
    if (currentTab && (currentTab.url.includes('atlassian.net') || currentTab.url.includes('confluence'))) {
      chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' }, function(response) {
        if (chrome.runtime.lastError) {
          // Content script not ready or not loaded - ignore silently
          return;
        }
        if (response && response.isRunning) {
          setButtonLoading(true);
          showStatus(`⏳ 処理中... (ページ ${response.currentPage}, ${response.totalUnwatched}個解除済み)`, 'info');
        }
      });
    }
  });
});