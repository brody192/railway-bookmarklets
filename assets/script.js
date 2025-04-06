(function () {
    let error = false;

    const loadBookmarklet = async function () {
        const jsReq = await fetch("bookmarklet.min.js", {
            headers: { "Cache-Control": "no-cache" },
        });

        if (jsReq.status != 200) {
            error = true;
            alert("Error loading minified bookmarklet code\nCheck console errors");
            return;
        }

        let js = await jsReq.text();

        if (!js.startsWith("javascript:")) {
            js = "javascript:" + js;
        }

        error = false;

        document.querySelector("#install").setAttribute("href", js);
    };

    loadBookmarklet();

    window.onfocus = function () {
        if (window.location.hostname != "127.0.0.1" || error == true) return;
        loadBookmarklet();
    }
})();