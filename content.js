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
    
    // More comprehensive selectors for unwatch links
    const selectors = [
      'a[href*="removewatchpage.action"]',
      'a[href*="removewatch"]',
      'a[href*="unwatch"]',
      'button[data-testid*="unwatch"]',
      'button[aria-label*="unwatch"]',
      'button[aria-label*="Unwatch"]',
      '.unwatch-button',
      '[data-action="unwatch"]'
    ];
    
    let unwatchElements = [];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      unwatchElements.push(...elements);
    }
    
    // Remove duplicates
    unwatchElements = [...new Set(unwatchElements)];
    
    console.log(`Found ${unwatchElements.length} unwatch elements on current page`);
    console.log('Current URL:', window.location.href);
    console.log('Page title:', document.title);
    
    if (unwatchElements.length === 0) {
      // Debug: log all links to see what's available
      const allLinks = document.querySelectorAll('a[href]');
      console.log(`Total links found: ${allLinks.length}`);
      const watchRelatedLinks = Array.from(allLinks).filter(link => 
        link.href.includes('watch') || link.textContent.includes('watch') || link.textContent.includes('Watch')
      );
      console.log('Watch-related links:', watchRelatedLinks.map(link => ({ href: link.href, text: link.textContent })));
    }
    
    for (let i = 0; i < unwatchElements.length; i++) {
      const element = unwatchElements[i];
      
      try {
        console.log(`Processing item ${i + 1}/${unwatchElements.length}:`, element);
        
        if (element.tagName.toLowerCase() === 'button') {
          // Handle button clicks
          element.click();
          unwatchedCount++;
          await this.delay(500);
        } else if (element.href) {
          // Handle link requests
          console.log(`Unwatching via URL: ${element.href}`);
          
          const response = await fetch(element.href, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
              'X-Requested-With': 'XMLHttpRequest'
            }
          });
          
          if (response.ok) {
            unwatchedCount++;
            element.closest('tr, .watch-item, .notification-item')?.remove();
          } else {
            console.warn(`Failed to unwatch: ${response.status} ${response.statusText}`);
          }
          
          await this.delay(300);
        }
      } catch (error) {
        console.error('Error unwatching item:', error);
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