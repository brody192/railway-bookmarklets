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
            query: `query template($code: String) {\n template(code: $code) {\n id\n metadata\n services {\n edges {\n node {\n config\n }\n}\n}\n}\n}`,
            variables: {
                "code": templateCode
            },
        });

        if (currentTemplateError != null) {
            alert("Error retrieving data on current template" + "\n" + currentTemplateError);
            return;
        };

        const currentTemplateId = currentTemplate.id;
        const currentTemplateName = currentTemplate.metadata.name;

        let currentServices = [];

        for (const service of currentTemplate.services.edges) {
            currentServices.push(service.node.config.name);
        };

        const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

        const sourceTemplateInputCode = tryTrim(prompt("Enter the template's short code that contains the service you want to embed into this template"));
        if (sourceTemplateInputCode == null) {
            alert("User canceled the prompt");
            return;
        };

        const [sourceTemplate, sourceTemplateError] = await gqlReq({
            operationName: "template",
            query: "query template($code: String) {\n template(code: $code) {\n metadata\n services {\n edges {\n node {\n config\n}\n}\n}\n}\n}",
            variables: {
                "code": sourceTemplateInputCode
            },
        });

        if (sourceTemplateError != null) {
            alert(`Error retrieving data on current template ${currentTemplateName}` + "\n" + sourceTemplateError);
            return;
        };

        if (sourceTemplate.services.edges.length == 0) {
            alert(`The source template ${currentTemplateName} does not contain any services`);
            return;
        };

        const sourceTemplateName = sourceTemplate.metadata.name;

        let sourceServiceNameConfigObj = {};

        for (const service of sourceTemplate.services.edges) {
            sourceServiceNameConfigObj[service.node.config.name] = service.node;
        };

        const sourceServices = Object.keys(sourceServiceNameConfigObj);

        const defaultService = (sourceServices.length == 1) ? sourceServices[0] : undefined;

        let sourceServiceList = "";

        for (const [i, service] of sourceServices.entries()) {
            sourceServiceList += `- ${service}`;
            if (i < sourceServices.length - 1) sourceServiceList += "\n";
        };

        const serviceToEmbed = tryTrim(prompt(`Enter the service from the ${sourceTemplateName} template to embed into this template\n${sourceServiceList}`, defaultService));
        if (serviceToEmbed == null) {
            alert("User canceled the prompt");
            return;
        };

        if (sourceServices.includes(serviceToEmbed) == false) {
            alert(`Service does not exist within the source template ${sourceTemplateName}`);
            return;
        };

        if (currentServices.includes(serviceToEmbed) == true) {
            alert(`Current template ${currentTemplateName} already contains the service ${serviceToEmbed}`);
            return;
        };

        const proceed = confirm(`Proceed with embedding service ${serviceToEmbed} into this template?\nThis will clear any unsaved changes`);
        if (proceed == false) {
            alert("User canceled the prompt");
            return;
        };

        const teamId = (params.has("teamId") == true) ? params.get("teamId") : null;

        htmlDoc.style.cursor = "wait";

        const [templateUpdate, templateUpdateError] = await gqlReq({
            operationName: "templateUpdate",
            query: "mutation templateUpdate($id: String!, $input: TemplateUpdateInput!) {\n templateUpdate(id: $id, input: $input) {\n id\n}\n}",
            variables: {
                "id": currentTemplateId,
                "input": {
                    "metadata": {
                        "name": currentTemplateName
                    },
                    "config": {
                        "plugins": []
                    },
                    "services": [sourceServiceNameConfigObj[serviceToEmbed]],
                    "teamId": teamId
                }
            },
        });

        if (templateUpdateError != null) {
            alert(`Error updating template ${currentTemplateName}` + "\n" + templateUpdateError);
            return;
        };

        alert(`Service ${serviceToEmbed} embeded successfully`);

        location.reload();
    })();

    htmlDoc.style.cursor = null;
})();