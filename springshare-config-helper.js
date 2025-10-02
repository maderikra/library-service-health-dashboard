// Springshare Configuration Helper
// Use this file to configure the correct URL and selectors for your Springshare monitoring

// STEP 1: Find the correct URL
// Replace this with the actual Springshare blog/status page URL where you see the outage posts
const SPRINGSHARE_URL = 'https://lounge.springshare.com/c/outages'; // Update this URL

// STEP 2: Test different selectors
// Open the Springshare page in browser, right-click on a blog post, "Inspect Element"
// Look for the HTML structure and update these selectors accordingly

const SPRINGSHARE_CONFIG = {
  name: 'Springshare Status Blog',
  url: SPRINGSHARE_URL,
  type: 'html',
  htmlConfig: {
    // Try these selectors one by one (uncomment the one that works)
    
    // For list-based blog posts:
    componentSelector: 'li:has(a[href*="discussion"])',
    
    // For article-based posts:
    // componentSelector: 'article, .post, .entry',
    
    // For discussion forum format:
    // componentSelector: '.discussion-item, .topic, .thread',
    
    // For div-based posts:
    // componentSelector: 'div[class*="post"], div[class*="entry"], div[class*="discussion"]',
    
    // Cast a very wide net (use this if others don't work):
    // componentSelector: 'li, article, .post, .entry, .item, [class*="post"], [class*="entry"]',
    
    customLogic: 'springshare-blog',
    statusClassMap: {
      'resolved': 'operational',
      'active': 'major_outage'
    },
    errorStatuses: ['major_outage']
  }
};

// STEP 3: Test with sample data
// Here's what the function expects to find:
const SAMPLE_HTML_STRUCTURE = `
<!-- Example 1: List with links -->
<li>
  <a href="https://lounge.springshare.com/discussion/4310/libguides-service-disruptions">
    LibGuides: Service Disruptions - NOT RESOLVED
  </a>
</li>
<li>
  <a href="https://lounge.springshare.com/discussion/4273/libauth-sso-login-issue">
    LibAuth/SSO login Issue -- RESOLVED
  </a>
</li>

<!-- Example 2: Article format -->
<article>
  <h2><a href="...">LibCal: Database Issues</a></h2>
  <p>We are experiencing database connectivity issues...</p>
</article>
`;

// STEP 4: Debugging tips
console.log('Springshare Configuration Helper');
console.log('1. Update SPRINGSHARE_URL with the correct blog URL');
console.log('2. Test different componentSelector options');
console.log('3. Check browser dev tools for actual HTML structure');
console.log('4. Look for posts that do NOT contain "resolved" in title');

module.exports = {
  SPRINGSHARE_CONFIG,
  SPRINGSHARE_URL,
  SAMPLE_HTML_STRUCTURE
};