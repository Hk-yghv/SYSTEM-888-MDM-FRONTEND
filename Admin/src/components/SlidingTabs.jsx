import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

export const useTabDirection = (activeTab, tabOrder) => {
    const [direction, setDirection] = useState('next');
    const previousTab = useRef(activeTab);

    useLayoutEffect(() => {
        const previousIndex = tabOrder.indexOf(previousTab.current);
        const activeIndex = tabOrder.indexOf(activeTab);

        if (previousIndex !== -1 && activeIndex !== -1 && previousIndex !== activeIndex) {
            setDirection(activeIndex > previousIndex ? 'next' : 'previous');
        }

        previousTab.current = activeTab;
    }, [activeTab, tabOrder]);

    return direction;
};

const SlidingTabs = ({ tabs, activeTab, onChange, className = '' }) => {
    const containerRef = useRef(null);
    const buttonRefs = useRef(new Map());
    const [indicatorPosition, setIndicatorPosition] = useState(null);
    const activeTabConfig = tabs.find(tab => tab.id === activeTab);

    const updateIndicatorPosition = useCallback(() => {
        const container = containerRef.current;
        const activeButton = buttonRefs.current.get(activeTab);
        if (!container || !activeButton) return;

        const containerRect = container.getBoundingClientRect();
        const buttonRect = activeButton.getBoundingClientRect();
        const nextPosition = {
            x: buttonRect.left - containerRect.left + container.scrollLeft,
            y: buttonRect.top - containerRect.top + container.scrollTop,
            width: buttonRect.width,
            height: buttonRect.height
        };

        setIndicatorPosition(previousPosition => {
            if (
                previousPosition &&
                previousPosition.x === nextPosition.x &&
                previousPosition.y === nextPosition.y &&
                previousPosition.width === nextPosition.width &&
                previousPosition.height === nextPosition.height
            ) {
                return previousPosition;
            }
            return nextPosition;
        });
    }, [activeTab]);

    useLayoutEffect(() => {
        updateIndicatorPosition();
    }, [updateIndicatorPosition]);

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const resizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(updateIndicatorPosition);
        resizeObserver?.observe(container);
        buttonRefs.current.forEach(button => resizeObserver?.observe(button));
        window.addEventListener('resize', updateIndicatorPosition);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updateIndicatorPosition);
        };
    }, [updateIndicatorPosition]);

    return (
        <div ref={containerRef} className={`sliding-tabs ${className}`}>
            {indicatorPosition && (
                <span
                    aria-hidden="true"
                    className={`sliding-tabs__indicator ${activeTabConfig?.indicatorClassName || ''}`}
                    style={{
                        width: indicatorPosition.width,
                        height: indicatorPosition.height,
                        transform: `translate3d(${indicatorPosition.x}px, ${indicatorPosition.y}px, 0)`
                    }}
                />
            )}
            {tabs.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        ref={element => {
                            if (element) buttonRefs.current.set(tab.id, element);
                            else buttonRefs.current.delete(tab.id);
                        }}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        disabled={tab.disabled}
                        aria-pressed={isActive}
                        className={`sliding-tab-button ${tab.className || ''} ${
                            isActive ? tab.activeClassName || '' : tab.inactiveClassName || ''
                        }`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
};

export default SlidingTabs;
