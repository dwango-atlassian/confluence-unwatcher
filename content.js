class ConfluenceUnwatcher {
  constructor() {
    this.isRunning = false;
    this.totalUnwatched = 0;
    this.currentPage = 1;
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
    this.totalUnwatched = 0;
    this.currentPage = 1;

    try {
      await this.navigateToWatchedPages();
      await this.processAllPages();
      
      alert(`完了しました！合計 ${this.totalUnwatched} 個のページのウォッチを解除しました。`);
    } catch (error) {
      console.error('Error during unwatching process:', error);
      alert(`エラーが発生しました: ${error.message}`);
    } finally {
      this.isRunning = false;
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

  async processAllPages() {
    let hasMorePages = true;
    
    while (hasMorePages) {
      console.log(`Processing page ${this.currentPage}...`);
      
      await this.delay(1000);
      
      const unwatchedCount = await this.unwatchCurrentPage();
      this.totalUnwatched += unwatchedCount;
      
      console.log(`Page ${this.currentPage}: ${unwatchedCount} items unwatched`);
      
      hasMorePages = await this.goToNextPage();
      if (hasMorePages) {
        this.currentPage++;
        await this.delay(2000);
      }
    }
  }

  async unwatchCurrentPage() {
    let unwatchedCount = 0;
    
    const unwatchLinks = document.querySelectorAll('a[href*="removewatchpage.action"], a[href*="removewatch"]');
    console.log(`Found ${unwatchLinks.length} unwatch links on current page`);
    
    for (let i = 0; i < unwatchLinks.length; i++) {
      const link = unwatchLinks[i];
      
      if (link && link.href) {
        try {
          console.log(`Unwatching item ${i + 1}/${unwatchLinks.length}`);
          
          const response = await fetch(link.href, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (response.ok) {
            unwatchedCount++;
            link.closest('tr')?.remove();
          } else {
            console.warn(`Failed to unwatch: ${response.status} ${response.statusText}`);
          }
          
          await this.delay(300);
        } catch (error) {
          console.error('Error unwatching item:', error);
        }
      }
    }
    
    return unwatchedCount;
  }

  async goToNextPage() {
    const nextButton = document.querySelector('a[title*="次"], a[title*="Next"], a.next, .pagination-next a, a[href*="startIndex"]');
    
    if (!nextButton || nextButton.classList.contains('disabled')) {
      return false;
    }
    
    const nextUrl = nextButton.href;
    if (!nextUrl) {
      return false;
    }
    
    console.log('Moving to next page...');
    window.location.href = nextUrl;
    
    await new Promise((resolve) => {
      const checkLoad = () => {
        if (document.readyState === 'complete') {
          setTimeout(resolve, 1000);
        } else {
          setTimeout(checkLoad, 500);
        }
      };
      checkLoad();
    });
    
    return true;
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