async function getGithubToken() {
    let token = localStorage.getItem('github_token');
    
    if (!token) {
      token = prompt('Please enter your GitHub API token:');
      if (token) {
        localStorage.setItem('github_token', token);
      }
    }
    
    return token;
  }
  
  async function fetchPRDetails() {
    const token = await getGithubToken();
    if (!token) {
      console.error('GitHub token not provided');
      return;
    }
  
    const pathParts = window.location.pathname.split('/');
    const owner = pathParts[1];
    const repo = pathParts[2];
    
    const prLinks = document.querySelectorAll('a[data-hovercard-type="pull_request"]');

    for (const link of prLinks) {
      const prNumber = link.href.split('/').pop();

      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        const prData = await response.json();

        const baseBranchLabel = document.createElement('span');
        baseBranchLabel.className = 'base-branch-label';
        baseBranchLabel.textContent = `Base: ${prData.base.ref}`;

        console.log(baseBranchLabel.textContent);

        link.insertAdjacentElement('afterend', baseBranchLabel);
      } catch (error) {
        console.error(`Error fetching PR #${prNumber}:`, error);
        if (error.status === 401) {
          localStorage.removeItem('github_token');
          fetchPRDetails();
        }
      }
    }
  }
  
  // Run immediately and also when navigation occurs
  fetchPRDetails();
  
  // Listen for any changes to the DOM that might indicate navigation
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.target.matches('.js-active-navigation-container')) {
        fetchPRDetails();
        break;
      }
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });