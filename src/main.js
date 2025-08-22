// Client-side loader for HTML fragments in `src/components` and `src/pages`.
// Loads header/footer components and the current page fragment, and enables
// basic SPA navigation using the History API so the site can be served as a
// single HTML entrypoint.

const ROUTES = {
	'/': '/pages/home.html',
	'/index.html': '/pages/home.html',
	'/home': '/pages/home.html',
	'/about': '/pages/about.html',
	'/contact': '/pages/contact.html',
	'/products-and-services': '/pages/products-and-services.html',
	'/client-success-stories': '/pages/client-success-stories.html',
	'/privacy-policy': '/pages/privacy-policy.html',
	'/terms-of-service': '/pages/terms-of-service.html'
};

// Vite-friendly raw imports (fast in dev). These will be transformed by Vite
// into functions that return the raw file contents. If available, prefer these
// to avoid fetch race conditions during development.
const pageModules = import.meta.glob('/src/pages/*.html', { as: 'raw' });
const compModules = import.meta.glob('/src/components/*.html', { as: 'raw' });

async function loadFromModules(url) {
	// Accept URLs like /src/pages/home.html or /pages/home.html
	if (!url) return null;
	const candidates = [];
	if (url.startsWith('/src/')) candidates.push(url);
	if (url.startsWith('/')) candidates.push(`/src${url}`);
	// Also accept without leading slash
	if (!url.startsWith('/')) candidates.push(`/src/${url}`);

	for (const c of candidates) {
		if (pageModules[c]) {
			try {
				return await pageModules[c]();
			} catch (e) {
				// ignore and continue
			}
		}
		if (compModules[c]) {
			try {
				return await compModules[c]();
			} catch (e) {
				// ignore
			}
		}
	}
	return null;
}

async function fetchText(url) {
	try {
		const res = await fetch(url, { cache: 'no-store' });
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		return await res.text();
	} catch (err) {
		console.error('Failed to fetch', url, err);
		return `<div style="padding:2rem;color:var(--text-color,#111)">Error loading ${url}: ${err.message}</div>`;
	}
}

// Try multiple URLs in order and return the first successful response text.
async function fetchFirst(urls) {
	for (const u of urls) {
		try {
			const res = await fetch(u, { cache: 'no-store' });
			if (!res.ok) continue;
			return await res.text();
		} catch (e) {
			// ignore and try next
		}
	}
	// If none succeeded, return an error message using the first url for clarity
	return await fetchText(urls[0]);
}

async function insertHTML(position, html) {
	const template = document.createElement('template');
	template.innerHTML = html.trim();
	const fragment = template.content;
	if (position === 'prepend') {
		// Insert fragment before the first child
		document.body.insertBefore(fragment, document.body.firstChild);
		// Return the first inserted node for reference
		return document.body.firstChild;
	} else {
		document.body.appendChild(fragment);
		return document.body.lastChild;
	}
}

async function loadComponents() {
	// Top nav -> prepend so it's above page content
	let topNavHtml = await loadFromModules('/src/components/top_nav.html');
	if (!topNavHtml) topNavHtml = await fetchFirst(['/components/top_nav.html', '/src/components/top_nav.html']);
	await insertHTML('prepend', topNavHtml);

	// Footer -> append
	let footerHtml = await loadFromModules('/src/components/footer.html');
	if (!footerHtml) footerHtml = await fetchFirst(['/components/footer.html', '/src/components/footer.html']);
	await insertHTML('append', footerHtml);

	// Populate dynamic bits (like copyright year)
	const yearEl = document.getElementById('copyYear');
	if (yearEl) yearEl.textContent = new Date().getFullYear();
}

function normalizePath(pathname) {
	// Strip trailing slash but keep root as '/'
	if (!pathname) return '/';
	if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
	return pathname;
}

async function loadPage(pathname = location.pathname) {
	const path = normalizePath(pathname);
	const pageUrl = ROUTES[path] || ROUTES['/'];

			// Try to load via Vite modules (dev) before fetching at runtime
			let contentHtml = await loadFromModules(pageUrl) || await loadFromModules(`/src${pageUrl}`);
			if (!contentHtml) {
				const fallback = pageUrl.startsWith('/') ? `/src${pageUrl}` : `src/${pageUrl}`;
				contentHtml = await fetchFirst([pageUrl, fallback]);
			}

	// Remove any previous page container
	const existing = document.getElementById('page-content');
	if (existing) existing.remove();

	// Insert new content after the top nav (if present) or at top of body
	const pageContainer = document.createElement('main');
	pageContainer.id = 'page-content';
	pageContainer.innerHTML = contentHtml;

	// Find where to place the main content: after header if header exists
	const header = document.querySelector('header');
	if (header && header.parentNode) {
		header.parentNode.insertBefore(pageContainer, header.nextSibling);
	} else {
		// No header; put at the top
		document.body.prepend(pageContainer);
	}

	// Update document title if the fragment has a data-title attribute on first element
	const firstEl = pageContainer.firstElementChild;
	if (firstEl && firstEl.dataset && firstEl.dataset.title) {
		document.title = firstEl.dataset.title;
	}

	// Rebind internal links within loaded content for SPA navigation
	bindInternalLinks(pageContainer);
}

function isInternalLink(a) {
	if (!a || !a.href) return false;
	try {
		const url = new URL(a.href, location.href);
		return url.origin === location.origin && url.pathname.startsWith('/');
	} catch (e) {
		return false;
	}
}

function bindInternalLinks(root = document) {
	const anchors = root.querySelectorAll('a[href]');
	anchors.forEach(a => {
		if (!isInternalLink(a)) return;
		if (a.hasAttribute('data-no-spa') || a.target === '_blank') return;

		// Remove existing handler marker to avoid double-binding
		if (a.__spaBound) return;
		a.__spaBound = true;

		a.addEventListener('click', (ev) => {
			const href = a.getAttribute('href');
			// allow hash links to behave normally
			if (href.startsWith('#')) return;
			ev.preventDefault();
			history.pushState({}, '', href);
			loadPage(href);
			// If the mobile dropdown is open, close it so nav hides on mobile after click
			const mobile = document.getElementById('mobileDropdown');
			if (mobile && !mobile.classList.contains('hidden')) {
				mobile.classList.add('hidden');
			}
		});
	});
}

function initRouter() {
	// Handle back/forward
	window.addEventListener('popstate', () => loadPage(location.pathname));

	// Global link handler for anchors outside loaded fragments
	document.addEventListener('click', (ev) => {
		const a = ev.target.closest && ev.target.closest('a');
		if (!a) return;
		if (!isInternalLink(a)) return;
		if (a.hasAttribute('data-no-spa') || a.target === '_blank') return;
		const href = a.getAttribute('href');
		if (href && href.startsWith('#')) return; // allow hash navigation
		// If this anchor is inside a loaded fragment it will already be handled;
		// otherwise handle it here.
		if (!a.__spaBound) {
			ev.preventDefault();
			history.pushState({}, '', href);
			loadPage(href);
			// Close mobile menu if open (useful for clicks from the mobile nav)
			const mobile = document.getElementById('mobileDropdown');
			if (mobile && !mobile.classList.contains('hidden')) {
				mobile.classList.add('hidden');
			}
		}
	});
}

async function boot() {
	try {
		console.debug('Loading components...');
		await loadComponents();
	} catch (err) {
		console.error('Failed to load components:', err);
	}

	try {
		console.debug('Loading initial page:', location.pathname);
		await loadPage(location.pathname);
	} catch (err) {
		console.error('Failed to load initial page:', err);
	}

	initRouter();
}

// Start the client loader. Modules are deferred; if the document has already
// finished loading, call boot immediately to avoid missing the DOMContentLoaded event.
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', boot);
} else {
	// Already loaded
	try {
		boot();
	} catch (err) {
		console.error('Error during boot:', err);
	}
}

// Helpful visibility while developing
console.debug('Client loader initialized');
