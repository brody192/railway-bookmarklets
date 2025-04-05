javascript: (async () => {
    const origin = window.location.origin;

    if (origin != "https://railway.com") {
        alert("This bookmarklet is designed to be used with Railway");
        return;
    };

    const modalElement = document.querySelector("div[role='alertdialog']");

    if (!modalElement) {
        alert("Unable to find modal");
        return;
    };

    const confirmTextRegex = /Type\s(.+?)\sto\sconfirm/;

    const confirmText = confirmTextRegex.exec(modalElement.textContent);

    if (confirmText == null) {
        alert("Unable to find confirm text");
        return;
    };

    const confirmInputElement = modalElement.querySelector("input");

    if (!confirmInputElement) {
        alert("Unable to find confirm input");
        return;
    };

    confirmInputElement.value = confirmText[1] + " ";
})();