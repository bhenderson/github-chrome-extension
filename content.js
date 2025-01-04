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
    
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open&per_page=100`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const allPRs = await response.json();
      const prDataMap = new Map(allPRs.map(pr => [pr.number.toString(), pr]));
      
      // Build dependency tree
      const dependencyMap = new Map();
      const rootPRs = new Set();

      allPRs.forEach(pr => {
        const prNumber = pr.number.toString();
        const baseBranch = pr.base.ref;
        
        const parentPR = allPRs.find(otherPR => otherPR.head.ref === baseBranch);
        
        if (parentPR) {
          const parentNumber = parentPR.number.toString();
          if (!dependencyMap.has(parentNumber)) {
            dependencyMap.set(parentNumber, new Set());
          }
          dependencyMap.get(parentNumber).add(prNumber);
        } else {
          rootPRs.add(prNumber);
        }
      });

      // Get the container and all PR elements
      const container = document.querySelector('.js-navigation-container');
      if (!container) return;

      // Get all PR elements and convert to array for sorting
      const prElements = Array.from(container.children).filter(el => {
        const id = el.id;
        return id && id.startsWith('issue_');
      });

      allPRs.sort((a, b) => (a.created_at).localeCompare(b.created_at));
      
      const tree = { pr: null, children: [] };
      const byHead = {};

      for (const pr of allPRs) {
        byHead[pr.head.ref] = { pr, children: [] };
      }

      for (const pr of allPRs) {
        const leaf = byHead[pr.base.ref] || tree;

        leaf.children.push(byHead[pr.head.ref]);
      }

      const elementByPRNumber = {};

      for (const el of prElements) {
        const prNumber = el.id.replace('issue_', '');
        elementByPRNumber[prNumber] = el;
      }

      // clear container
      container.innerHTML = '';

      function traverseTree(tree, depth = 0) {
        console.log('traversing tree');
        const { pr, children } = tree;
        if (pr && elementByPRNumber[pr.number]) {
          const el = elementByPRNumber[pr.number];
          container.appendChild(el);

          if (children.length > 0 || depth > 1) {
            const depthLabel = document.createElement('span');
            depthLabel.classList.add('base-branch-label');
            depthLabel.textContent = `${depth}`;
            const openedBySpan = el.querySelector('.opened-by');
            if (openedBySpan) {
              openedBySpan.parentNode.insertBefore(depthLabel, openedBySpan);
            }
          }
        }
        for (const child of children) {
          traverseTree(child, depth + 1);
        }
      }

      traverseTree(tree);

    } catch (error) {
      console.error('Error fetching PRs:', error);
      if (error.status === 401) {
        localStorage.removeItem('github_token');
        fetchPRDetails();
      }
    }
  }
  
  // Run immediately and also when navigation occurs
  fetchPRDetails();
  
//   // Listen for any changes to the DOM that might indicate navigation
//   const observer = new MutationObserver((mutations) => {
//     for (const mutation of mutations) {
//       if (mutation.type === 'childList' && mutation.target.matches('.js-active-navigation-container')) {
//         fetchPRDetails();
//         break;
//       }
//     }
//   });
  
//   observer.observe(document.body, {
//     childList: true,
//     subtree: true
//   });