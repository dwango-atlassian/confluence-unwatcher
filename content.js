// Prevent duplicate execution
if (window.confluenceUnwatcher) {
  console.log('Confluence Unwatcher already loaded');
} else {

class ConfluenceUnwatcher {
  constructor() {
    this.isRunning = false;
    this.totalUnwatched = this.loadTotalCount();
    
    // Check if we should auto-continue after reload
    this.checkAutoContinue();
  }
  
  saveState(isProcessing, totalCount) {
    localStorage.setItem('confluenceUnwatcher_processing', isProcessing.toString());
    localStorage.setItem('confluenceUnwatcher_totalCount', totalCount.toString());
  }
  
  loadTotalCount() {
    const saved = localStorage.getItem('confluenceUnwatcher_totalCount');
    return saved ? parseInt(saved) : 0;
  }
  
  isAutoProcessing() {
    return localStorage.getItem('confluenceUnwatcher_processing') === 'true';
  }
  
  clearState() {
    localStorage.removeItem('confluenceUnwatcher_processing');
    localStorage.removeItem('confluenceUnwatcher_totalCount');
  }
  
  async checkAutoContinue() {
    if (this.isAutoProcessing() && window.location.href.includes('viewnotifications')) {
      console.log('Auto-continuing after reload...');
      await this.delay(2000); // Wait for page to fully load
      await this.unwatchAll();
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async unwatchAll() {
    if (this.isRunning) {
      console.log('Already running');
      return;
    }

    this.isRunning = true;
    
    // If this is a fresh start, reset total count
    if (!this.isAutoProcessing()) {
      this.totalUnwatched = 0;
    }
    
    // Mark as processing
    this.saveState(true, this.totalUnwatched);
    
    try {
      await this.processLoop();
      this.clearState();
      console.log(`🎉 完了しました！合計 ${this.totalUnwatched} 個のウォッチを解除しました。`);
    } catch (error) {
      console.error('Error:', error);
      this.clearState();
      console.error(`エラーが発生しました: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async processLoop() {
    while (true) {
      console.log('Processing current page...');
      
      // 1. ページの上からウォッチの中止を順に行う
      const unwatchedCount = await this.unwatchCurrentPage();
      this.totalUnwatched += unwatchedCount;
      
      // Update saved state
      this.saveState(true, this.totalUnwatched);
      
      console.log(`Unwatched ${unwatchedCount} items (Total: ${this.totalUnwatched})`);
      
      // ウォッチの中止対象がなくなったら終了
      if (unwatchedCount === 0) {
        console.log('No more items to unwatch, finished');
        break;
      }
      
      // 2. 全て実行したらページを自動リロードする
      console.log('Reloading page...');
      window.location.reload();
      
      // リロード後はcheckAutoContinueで処理が再開される
      return;
    }
  }

  async unwatchCurrentPage() {
    let unwatchedCount = 0;
    
    // ウォッチの中止リンクを取得
    const unwatchLinks = document.querySelectorAll('a.link-stop-watching');
    
    console.log(`Found ${unwatchLinks.length} unwatch links`);
    
    for (let i = 0; i < unwatchLinks.length; i++) {
      const link = unwatchLinks[i];
      
      try {
        console.log(`Clicking unwatch link ${i + 1}/${unwatchLinks.length}`);
        
        // クリックして解除
        link.click();
        unwatchedCount++;
        
        // 少し待機
        await this.delay(800);
        
      } catch (error) {
        console.error('Error clicking unwatch link:', error);
      }
    }
    
    return unwatchedCount;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      totalUnwatched: this.totalUnwatched
    };
  }
}

const confluenceUnwatcher = new ConfluenceUnwatcher();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'unwatchAll') {
    confluenceUnwatcher.unwatchAll();
    sendResponse({ success: true });
  } else if (request.action === 'getStatus') {
    sendResponse(confluenceUnwatcher.getStatus());
  }
  return true;
});

window.confluenceUnwatcher = confluenceUnwatcher;

}