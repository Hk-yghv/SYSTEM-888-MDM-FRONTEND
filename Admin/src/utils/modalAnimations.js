const POPUP_SELECTOR = '[role="dialog"], .fixed.inset-0';
const ANIMATED_BACKDROP_CLASS = 'popup-backdrop-enter';
const RESPONSIVE_BACKDROP_CLASS = 'popup-backdrop-responsive';
const ANIMATED_PANEL_CLASS = 'popup-panel-enter';
const RESPONSIVE_PANEL_CLASS = 'popup-panel-responsive';

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
        element.classList.add(RESPONSIVE_BACKDROP_CLASS);

        // Ensure backdrop allows vertical scroll on small/laptop screens
        element.style.setProperty('overflow-y', 'auto', 'important');
        element.style.setProperty('align-items', 'flex-start', 'important');

        const panel = Array.from(element.children).find(child => (
            child instanceof HTMLElement &&
            !child.classList.contains('fixed') &&
            !child.classList.contains('absolute')
        ));

        if (panel) {
            panel.classList.add(ANIMATED_PANEL_CLASS);
            panel.classList.add(RESPONSIVE_PANEL_CLASS);
            panel.style.setProperty('margin', 'auto', 'important');
            panel.style.setProperty('max-height', 'calc(100dvh - 1.5rem)', 'important');
            panel.style.setProperty('max-width', 'min(calc(100vw - 1rem), 100%)', 'important');

            // Find internal scroll containers and ensure min-height: 0 so flex child scrolls properly
            const scrollContainers = panel.querySelectorAll('.overflow-y-auto, .overflow-auto, table-container');
            scrollContainers.forEach(sc => {
                if (sc instanceof HTMLElement) {
                    sc.style.setProperty('min-height', '0');
                }
            });
        }
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
            element.classList.remove(RESPONSIVE_BACKDROP_CLASS);
        });
        document.querySelectorAll(`.${ANIMATED_PANEL_CLASS}`).forEach(element => {
            element.classList.remove(ANIMATED_PANEL_CLASS);
            element.classList.remove(RESPONSIVE_PANEL_CLASS);
        });
    };
};
