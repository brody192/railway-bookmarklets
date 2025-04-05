javascript: (async () => {
    if (window.location.origin != "https://railway.com") {
        alert("This bookmarklet is designed to be used with Railway");
        return;
    };

    const projectRegex = /\/project\/(.+?)(?:\/|$)/;
    const serviceRegex = /\/service\/(.+?)(?:$|\?id)/;

    const pathname = window.location.pathname;

    if (projectRegex.exec(pathname) == null) {
        alert("No Project ID could be found, are you in a Project?");
        return;
    };

    if (serviceRegex.exec(pathname) == null) {
        alert("No Service ID could be found, do you have a Service open?");
        return;
    };

    const queryString = window.location.search;

    if (!queryString || !queryString.startsWith("?id=")) {
        alert("No Deployment could be found, do you have a Deployment open?");
        return;
    };

    const deploymentId = queryString.slice(4);

    const buildLogsBtn = document.querySelector("[id$='trigger-build']");
    const deployLogsBtn = document.querySelector("[id$='trigger-deploy']");

    if (buildLogsBtn == null || deployLogsBtn == null) {
        alert("Unknown state, contact maintainer");
        return;
    };

    const buildLogsBtnState = buildLogsBtn.getAttribute("data-state");
    const deployLogsBtnState = deployLogsBtn.getAttribute("data-state");

    const unknownStateMsg = "Unknown state, contact maintainer";

    if (buildLogsBtnState == null || deployLogsBtnState == null) {
        alert(unknownStateMsg);
        return;
    };

    const expectedStates = ["active", "inactive"];

    if (expectedStates.includes(buildLogsBtnState) == false || expectedStates.includes(buildLogsBtnState) == false) {
        alert(unknownStateMsg);
        return;
    };

    if (buildLogsBtnState == "inactive" && deployLogsBtnState == "inactive") {
        alert("Select the log type to download by opening the Build logs or the Deploy logs");
        return;
    };

    let operationName;
    let friendlyOperationName;

    if (buildLogsBtnState == "active") {
        friendlyOperationName = "build logs";
        operationName = "buildLogs";
    };

    if (deployLogsBtnState == "active") {
        friendlyOperationName = "deployment logs";
        operationName = "deploymentLogs";
    };

    const downloadConfirm = confirm(`Download the ${friendlyOperationName} for the currently open service?`);
    if (downloadConfirm == false) {
        alert("User canceled the prompt");
        return;
    };

    const logsReq = await fetch(`https://backboard.railway.com/graphql/internal?q=${operationName}`, {
        headers: {
            "cache-control": "no-cache",
            "content-type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
            operationName: operationName,
            query: `query ${operationName}($deploymentId: String!) {\n ${operationName}(deploymentId: $deploymentId\n limit: 2500\n) {\n message\n attributes {\n key\n value\n}\n}\n}`,
            variables: { deploymentId: deploymentId },
        }),
        mode: "cors",
        credentials: "include",
    });

    if (logsReq.status != 200) {
        alert(`Non 200 status code returned from API: ${logsReq.status}\ncontact maintainer`);
        return;
    };

    const logs = await logsReq.json();

    if (logs.errors != undefined) {
        alert(logs.errors[0].message);
        return;
    };

    if (logs.data == null) {
        alert("The API returned the null data type");
        return;
    };

    if (logs.data[operationName].length == 0) {
        alert("The API didn't return any log lines");
        return;
    };

    let logParts = [];

    logs.data[operationName].forEach((logLine, i) => {
        let message = logLine.message;

        // skip first line if blank
        if (i == 0 && message == "") return;

        // remove colour codes
        message = message.replace(/\u001b[^m]*?m/g, "");

        // handle json attributes, making sure to ignore the json normalization
        if (logLine.attributes && logLine.attributes.length && !(logLine.attributes.length == 1 && logLine.attributes[0].key == "level")) {
            let attributes = logLine.attributes;

            attributes.sort((a, b) => {
                return a.key.localeCompare(b.key);
            });

            let attributesSuffix = "";

            logLine.attributes.forEach((attribute) => {
                attributesSuffix += ` ${attribute.key}=${attribute.value}`;
            });

            message = `message="${message}"${attributesSuffix}`;
        };

        logParts.push(message);

        if (i < logs.data[operationName].length - 1) logParts.push("\n");
    });

    const blob = new Blob(logParts, { type: 'text/plain' });

    if (logParts.length == 0) {
        alert("No log lines where parsed");
        return;
    };

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    const ogTitle = document.querySelector("meta[property='og:title']");

    const serviceName = (ogTitle != null) ? "_" + ogTitle.getAttribute("content").toLowerCase() : "";

    link.download = (friendlyOperationName + serviceName + "_" + Math.floor(Date.now() / 1000) + ".log").replaceAll(" ", "_");

    link.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
    }));

    setTimeout(() => {
        window.URL.revokeObjectURL(url);
        link.remove();
    }, 100);
})();