javascript: (async () => {
    const htmlDoc = document.querySelector("html");

    await (async () => {
        const origin = window.location.origin;

        if (origin != "https://railway.com") {
            alert("This bookmarklet is designed to be used with Railway");
            return;
        };

        const projectRegex = /\/project\/(.+?)(?:\/|$)/;
        const serviceRegex = /\/service\/(.+?)(?:$|\?id|\/)/;

        const pathname = window.location.pathname;

        const projectMatch = projectRegex.exec(pathname);

        if (projectMatch == null) {
            alert("No Project ID could be found, are you in a Project?");
            return;
        };

        const projectID = projectMatch[1];

        const serviceMatch = serviceRegex.exec(pathname);

        if (serviceMatch == null) {
            alert("No Service ID could be found, do you have a Service open?");
            return;
        };

        const serviceID = serviceMatch[1];

        const activeEnvironmentsStr = window.localStorage.getItem("settings.activeEnvironments");

        const activeEnvironments = JSON.parse(activeEnvironmentsStr);

        const environmentID = activeEnvironments[projectID];

        const gqlReq = async (options) => {
            const req = await fetch(`https://backboard.railway.com/graphql/internal?q=${options.operationName}`, {
                headers: {
                    "cache-control": "no-cache",
                    "content-type": "application/json",
                },
                method: "POST",
                body: JSON.stringify({
                    operationName: options.operationName,
                    query: options.query,
                    variables: options.variables,
                }),
                mode: "cors",
                credentials: "include",
            });

            if (req.status != 200) {
                return [null, Error("Non 200 status code returned from API: " + req.status)];
            };

            const res = await req.json();

            if (res.errors != undefined) {
                return [null, Error(res.errors[0].message)];
            };

            if (res.data == null) {
                return [null, Error("The API returned the null data type")];
            };

            const dataName = (options.dataName == undefined) ? options.operationName : options.dataName;

            return [res.data[dataName], null];
        };

        htmlDoc.style.cursor = "wait";

        const [serviceInstance, serviceInstanceError] = await gqlReq({
            operationName: "serviceInstance",
            query: "query serviceInstance($environmentId: String!, $serviceId: String!) {\n serviceInstance(environmentId: $environmentId, serviceId: $serviceId) {\n source {\n image\n repo\n}\n}\n}",
            variables: {
                "environmentId": environmentID,
                "serviceId": serviceID,
            },
        });

        if (serviceInstanceError != null) {
            alert("Get service info error" + "\n" + serviceInstanceError);
            return;
        };

        const hasImage = (serviceInstance.source != null && serviceInstance.source.image != null);

        const promptText = (hasImage) ? "Enter the new image to deploy, or remove it" : "Enter the image to deploy";
        const defaultText = (hasImage) ? serviceInstance.source.image : "";

        const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

        const image = tryTrim(prompt(promptText, defaultText));
        if (image == null) {
            alert("User canceled the prompt");
            return;
        };

        if (hasImage && image == serviceInstance.source.image) {
            alert("Image already exists on the service");
            return;
        };

        if (image == "" && hasImage == true) {
            const disconnect = confirm("Disconnect docker image from service?");
            if (!disconnect) {
                alert("User canceled the prompt");
                return;
            };

            const [serviceDisconnect, serviceDisconnectError] = await gqlReq({
                operationName: "serviceDisconnect",
                query: "mutation serviceDisconnect($id: String!) {\n serviceDisconnect(id: $id) {\n id\n }\n}",
                variables: {
                    "id": serviceID
                },
            });

            if (serviceDisconnectError != null) {
                alert("Image disconnect error" + "\n" + serviceDisconnectError);
                return;
            };

            alert("Disconnected image successfully");
            return;
        };

        const [serviceConnect, serviceConnectError] = await gqlReq({
            operationName: "serviceConnect",
            query: "mutation serviceConnect($id: String!, $input: ServiceConnectInput!) {\n serviceConnect(id: $id, input: $input) {\n id\n}\n}",
            variables: {
                "id": serviceID,
                "input": { "image": image }
            },
        });

        if (serviceConnectError != null) {
            alert("Image deploy error" + "\n" + serviceConnectError);
            return;
        };

        alert("Trigged deploy successfully");
    })();

    htmlDoc.style.cursor = null;
})();