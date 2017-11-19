document.querySelectorAll('[data-pop]').forEach((el) => {
    el.addEventListener('click', (event) => {
        window.open(browser.extension.getURL(el.getAttribute('data-pop')),
            'live-reload',
            `width=400,height=600,
            left=${Math.min(screen.width - 420, event.screenX)},
            top=${event.screenY + 20}`
        );
    });
});
