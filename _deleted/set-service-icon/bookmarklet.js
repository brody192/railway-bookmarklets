javascript: (async () => {
    const htmlDoc = document.querySelector("html");

    await (async () => {
        if (window.location.origin != "https://railway.com") {
            alert("This bookmarklet is designed to be used with Railway");
            return;
        };

        const pathname = window.location.pathname;

        if (pathname != "/button") {
            alert("Template button page not found, do you have an edit page open?");
            return;
        };

        const params = new URLSearchParams(document.location.search);

        const templateCode = params.get("code");

        if (templateCode == null) {
            alert("Template edit page found, but the template has not been saved yet");
            return;
        };

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

        const [currentTemplate, currentTemplateError] = await gqlReq({
            operationName: "template",
            query: "query template($owner: String, $repo: String, $code: String) {\n template(owner: $owner, repo: $repo, code: $code) {\n ...TemplateFields\n }\n}\n\nfragment TemplateFields on Template {\n id\n code\n createdAt\n demoProjectId\n userId\n teamId\n metadata\n config\n serializedConfig\n status\n isApproved\n communityThreadSlug\n isV2Template\n health\n projects\n services {\n edges {\n node {\n ...TemplateServiceFields\n }\n }\n }\n}\n\nfragment TemplateServiceFields on TemplateService {\n id\n config\n}",
            variables: {
                "code": templateCode
            },
        });

        if (currentTemplateError != null) {
            alert("Error retrieving data on current template" + "\n" + currentTemplateError);
            return;
        };

        let currentServices = [];

        let currentServicesWithIcons = [];
        let currentServicesWithoutIcons = [];

        for (const service of currentTemplate.services.edges) {
            currentServices.push(service.node.config.name);

            if (service.node.config.icon) {
                currentServicesWithIcons.push(service.node.config.name);
                continue;
            };

            currentServicesWithoutIcons.push(service.node.config.name);
        };

        let currentServicesPrompt = "Enter the service name you want to set an icon for\n";

        if (currentServicesWithIcons.length > 0) {
            currentServicesPrompt += "\nCurrent services with icons:\n";

            for (const [i, service] of currentServicesWithIcons.entries()) {
                currentServicesPrompt += `- ${service}`;
                if (i < currentServicesWithIcons.length - 1) currentServicesPrompt += "\n";
            };
        };

        if (currentServicesWithoutIcons.length > 0) {
            currentServicesPrompt += "\nCurrent services without icons:\n";

            for (const [i, service] of currentServicesWithoutIcons.entries()) {
                currentServicesPrompt += `- ${service}`;
                if (i < currentServicesWithoutIcons.length - 1) currentServicesPrompt += "\n";
            };
        };

        currentServicesPrompt += "\n";

        const defaultService = (currentServices.length == 1) ? currentServices[0] : undefined;

        const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

        const serviceForIcon = tryTrim(prompt(currentServicesPrompt, defaultService));
        if (serviceForIcon == null) {
            alert("User canceled the prompt");
            return;
        };

        if (!currentServices.includes(serviceForIcon)) {
            alert("Service does not exist within the current template");
            return;
        };

        const iconURL = tryTrim(prompt(("Enter the URL of the icon you want to set for this service")));
        if (iconURL == null || iconURL == "") {
            alert("User canceled the prompt");
            return;
        };

        const isValidUrl = urlString => {
            try {
                return Boolean(new URL(urlString));
            } catch (e) {
                return false;
            };
        };

        if (!isValidUrl(iconURL)) {
            alert("Not a valid URL");
            return;
        };

        let currentTemplateServicesEdges = currentTemplate.services.edges;

        let currentTemplateServices = [];

        for (let i = 0; i < currentTemplate.services.edges.length; i++) {
            if (currentTemplate.services.edges[i].node.config.name != serviceForIcon) {
                continue;
            };

            currentTemplateServicesEdges[i].node.config.icon = iconURL;

            currentTemplateServices.push(currentTemplateServicesEdges[i].node);
        };

        const currentTemplateId = currentTemplate.id;
        const currentTemplateName = currentTemplate.metadata.name;

        const teamId = (params.has("teamId") == true) ? params.get("teamId") : null;

        htmlDoc.style.cursor = "wait";

        const [templateUpdate, templateUpdateError] = await gqlReq({
            operationName: "templateUpdate",
            query: "mutation templateUpdate($id: String!, $input: TemplateUpdateInput!) {\n templateUpdate(id: $id, input: $input) {\n ...TemplateFields\n }\n}\n\nfragment TemplateFields on Template {\n id\n code\n createdAt\n demoProjectId\n userId\n teamId\n metadata\n config\n serializedConfig\n status\n isApproved\n communityThreadSlug\n isV2Template\n health\n projects\n services {\n edges {\n node {\n ...TemplateServiceFields\n }\n }\n }\n}\n\nfragment TemplateServiceFields on TemplateService {\n id\n config\n}",
            variables: {
                "id": currentTemplateId,
                "input": {
                    "metadata": {
                        "name": currentTemplateName
                    },
                    "config": {
                        "plugins": []
                    },
                    "services": currentTemplateServices,
                    "teamId": teamId
                }
            },
        });

        if (templateUpdateError != null) {
            alert(`Error updating template ${currentTemplateName}` + "\n" + templateUpdateError);
            return;
        };

        alert(`Icon added successfully`);

        window.open("https://railway.com/template/" + templateCode, '_blank').focus();

        window.location.replace("https://railway.com/account/templates?code=" + templateCode);
    })();

    htmlDoc.style.cursor = null;
})();