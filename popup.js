document.addEventListener('DOMContentLoaded', function() {
  const unwatchButton = document.getElementById('unwatchButton');
  
  unwatchButton.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('atlassian.net') && !tab.url.includes('confluence')) {
        alert('❌ Confluenceのページで実行してください');
        return;
      }
      
      chrome.tabs.sendMessage(tab.id, { action: 'unwatchAll' }, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
          alert('⚠️ エラーが発生しました。ページを更新して再試行してください。');
          return;
        }
        
        if (response && response.success) {
          console.log('処理を開始しました');
        } else {
          alert('❌ 処理の開始に失敗しました');
        }
      });
      
    } catch (error) {
      console.error('Error:', error.message || error);
      alert('❌ エラーが発生しました');
    }
  });
});