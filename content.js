// Prevent duplicate execution
if (window.confluenceUnwatcher) {
  console.log('Confluence Unwatcher already loaded');
} else {

class ConfluenceUnwatcher {
  constructor() {
    this.isRunning = false;
    this.totalUnwatched = this.loadTotalCount();
    this.currentPage = 1;
    
    // Check if auto-continue is enabled
    this.checkAutoContinue();
  }
  
  saveState(isProcessing = false) {
    localStorage.setItem('confluenceUnwatcher_processing', isProcessing.toString());
    localStorage.setItem('confluenceUnwatcher_totalCount', this.totalUnwatched.toString());
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
    localStorage.removeItem('confluenceUnwatcher_lastUrl');
  }
  
  async checkAutoContinue() {
    // Only auto-continue if it's a natural page navigation (not reload)
    if (this.isAutoProcessing() && this.isConfluencePage() && window.location.href.includes('viewnotifications')) {
      // Check if this is a natural continuation vs manual navigation
      const lastUrl = localStorage.getItem('confluenceUnwatcher_lastUrl');
      const currentUrl = window.location.href;
      
      // If URLs are very different or this looks like a reload, stop auto-processing
      if (lastUrl && this.isLikelyManualNavigation(lastUrl, currentUrl)) {
        console.log('Manual navigation detected, stopping auto-continue');
        this.clearState();
        return;
      }
      
      console.log('Auto-continuing unwatch process...');
      await this.delay(2000); // Wait for page to fully load
      await this.autoContinueUnwatch();
    }
  }
  
  isLikelyManualNavigation(lastUrl, currentUrl) {
    // If URLs are exactly the same, it's likely a reload
    if (lastUrl === currentUrl) return true;
    
    // If startIndex decreased or went to a different section, it's likely manual
    const lastIndex = this.extractStartIndex(lastUrl);
    const currentIndex = this.extractStartIndex(currentUrl);
    
    if (lastIndex !== null && currentIndex !== null && currentIndex <= lastIndex) {
      return true;
    }
    
    return false;
  }
  
  extractStartIndex(url) {
    const match = url.match(/startIndex=(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
  
  async autoContinueUnwatch() {
    this.isRunning = true;
    
    try {
      const unwatchedCount = await this.unwatchCurrentPage();
      this.totalUnwatched += unwatchedCount;
      this.saveState(true);
      
      console.log(`Auto-continue: ${unwatchedCount} items unwatched (Total: ${this.totalUnwatched})`);
      
      // Check if there are more pages
      const nextButton = document.querySelector('a[title*="次"], a[title*="Next"], a.next, .pagination-next a, a[href*="startIndex"]');
      
      if (nextButton && !nextButton.classList.contains('disabled') && nextButton.href) {
        console.log('Moving to next page automatically...');
        window.location.href = nextButton.href;
      } else {
        this.clearState();
        alert(`🎉 すべて完了しました！\n\n合計 ${this.totalUnwatched} 個のウォッチを解除しました。`);
      }
    } catch (error) {
      console.error('Error during auto-continue:', error);
      this.clearState();
      alert(`エラーが発生しました: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  isConfluencePage() {
    return window.location.hostname.includes('atlassian.net') || 
           window.location.hostname.includes('confluence') ||
           document.querySelector('[data-testid="confluence-navigation"]') !== null;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async unwatchAllPages() {
    if (this.isRunning) {
      console.log('Already running unwatcher process');
      return;
    }

    if (!this.isConfluencePage()) {
      alert('このページはConfluenceではありません。Confluenceのウォッチリストページで実行してください。');
      return;
    }

    this.isRunning = true;
    this.saveState(true); // Enable auto-continue mode

    try {
      await this.navigateToWatchedPages();
      await this.processCurrentPageWithContinue();
    } catch (error) {
      console.error('Error during unwatching process:', error);
      this.clearState();
      alert(`エラーが発生しました: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  async processCurrentPageWithContinue() {
    console.log(`Processing current page...`);
    
    await this.delay(1000);
    
    const unwatchedCount = await this.unwatchCurrentPage();
    this.totalUnwatched += unwatchedCount;
    this.saveState(true);
    
    console.log(`Current page processed: ${unwatchedCount} items unwatched (Total: ${this.totalUnwatched})`);
    
    // Check if there are more pages
    const nextButton = document.querySelector('a[title*="次"], a[title*="Next"], a.next, .pagination-next a, a[href*="startIndex"]');
    
    if (nextButton && !nextButton.classList.contains('disabled') && nextButton.href) {
      console.log('Moving to next page automatically...');
      // Save current URL before navigation
      localStorage.setItem('confluenceUnwatcher_lastUrl', window.location.href);
      window.location.href = nextButton.href;
    } else {
      this.clearState();
      alert(`🎉 すべて完了しました！\n\n合計 ${this.totalUnwatched} 個のウォッチを解除しました。`);
    }
  }

  async navigateToWatchedPages() {
    const baseUrl = window.location.origin;
    const watchedPagesUrl = `${baseUrl}/wiki/users/viewnotifications`;
    
    if (!window.location.href.includes('viewnotifications')) {
      console.log('Navigating to watched pages...');
      window.location.href = watchedPagesUrl;
      
      await new Promise((resolve) => {
        const checkLoad = () => {
          if (window.location.href.includes('viewnotifications') && 
              document.readyState === 'complete') {
            resolve();
          } else {
            setTimeout(checkLoad, 500);
          }
        };
        checkLoad();
      });
    }
  }


  async unwatchCurrentPage() {
    let unwatchedCount = 0;
    
    // Look for the specific "ウォッチの中止" (Stop watching) links
    const unwatchLinks = document.querySelectorAll('a.link-stop-watching');
    
    console.log(`Found ${unwatchLinks.length} unwatch links on current page`);
    console.log('Current URL:', window.location.href);
    console.log('Page title:', document.title);
    
    if (unwatchLinks.length === 0) {
      // Debug: log all links to see what's available
      const allLinks = document.querySelectorAll('a[href]');
      console.log(`Total links found: ${allLinks.length}`);
      const watchRelatedElements = document.querySelectorAll('.link-stop-watching, .link-start-watching, .entity-watching');
      console.log('Watch-related elements:', watchRelatedElements);
      
      // Also check for any text containing "ウォッチ"
      const watchText = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('ウォッチ')
      );
      console.log('Elements with ウォッチ text:', watchText.slice(0, 5)); // Log first 5
    }
    
    for (let i = 0; i < unwatchLinks.length; i++) {
      const link = unwatchLinks[i];
      
      try {
        console.log(`Clicking unwatch link ${i + 1}/${unwatchLinks.length}:`, link.textContent);
        
        // Click the link to trigger the JavaScript unwatch action
        link.click();
        unwatchedCount++;
        
        // Wait for the action to complete
        await this.delay(800);
        
        // Optional: Check if the element was removed/hidden
        const row = link.closest('tr');
        if (row && (row.style.display === 'none' || !document.contains(link))) {
          console.log('Row was removed successfully');
        }
        
      } catch (error) {
        console.error('Error clicking unwatch link:', error);
      }
    }
    
    return unwatchedCount;
  }


  getStatus() {
    return {
      isRunning: this.isRunning,
      totalUnwatched: this.totalUnwatched,
      currentPage: this.currentPage
    };
  }
}

const confluenceUnwatcher = new ConfluenceUnwatcher();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'unwatchAll') {
    confluenceUnwatcher.unwatchAllPages();
    sendResponse({ success: true });
  } else if (request.action === 'getStatus') {
    sendResponse(confluenceUnwatcher.getStatus());
  }
  return true;
});

window.confluenceUnwatcher = confluenceUnwatcher;

// Clear state on page unload (refresh, close tab, navigate away)
window.addEventListener('beforeunload', () => {
  // Only clear if user is manually navigating away
  if (confluenceUnwatcher.isAutoProcessing()) {
    const isAutoNavigation = performance.getEntriesByType('navigation')[0]?.type === 'navigate';
    if (!isAutoNavigation) {
      console.log('Page unload detected, clearing auto-continue state');
      confluenceUnwatcher.clearState();
    }
  }
});

}