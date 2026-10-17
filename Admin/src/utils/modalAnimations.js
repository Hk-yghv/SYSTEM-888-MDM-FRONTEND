const POPUP_SELECTOR = '[role="dialog"], .fixed.inset-0';
const ANIMATED_BACKDROP_CLASS = 'popup-backdrop-enter';
const ANIMATED_PANEL_CLASS = 'popup-panel-enter';

const isFullScreenOverlay = (element) => {
    if (element.classList.contains('fixed') && element.classList.contains('inset-0')) {
        return true;
    }

    if (window.getComputedStyle(element).position !== 'fixed') return false;
    const rect = element.getBoundingClientRect();
    return rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9;
};

const animatePopup = (element) => {
    if (!(element instanceof HTMLElement)) return;

    if (isFullScreenOverlay(element)) {
        element.classList.add(ANIMATED_BACKDROP_CLASS);
        const panel = Array.from(element.children).find(child => child instanceof HTMLElement);
        if (panel) panel.classList.add(ANIMATED_PANEL_CLASS);
        return;
    }

    element.classList.add(ANIMATED_PANEL_CLASS);
};

export const installModalAnimations = () => {
    const processNode = (node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(POPUP_SELECTOR)) animatePopup(node);
        node.querySelectorAll(POPUP_SELECTOR).forEach(animatePopup);
    };

    processNode(document.body);
    const observer = new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(processNode));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
        observer.disconnect();
        document.querySelectorAll(`.${ANIMATED_BACKDROP_CLASS}`).forEach(element => {
            element.classList.remove(ANIMATED_BACKDROP_CLASS);
        });
        document.querySelectorAll(`.${ANIMATED_PANEL_CLASS}`).forEach(element => {
            element.classList.remove(ANIMATED_PANEL_CLASS);
        });
    };
};
