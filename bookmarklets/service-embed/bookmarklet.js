javascript: (async () => {
    const htmlDoc = document.querySelector("html");

    await (async () => {
        if (window.location.origin != "https://railway.com") {
            alert("This bookmarklet is designed to be used with Railway");
            return;
        };

        const pathname = window.location.pathname;

        if (pathname != "/compose") {
            alert("Template compose page not found, do you have an edit page open?");
            return;
        };

        const params = new URLSearchParams(document.location.search);

        const templateCode = params.get("code");

        if (templateCode == null) {
            alert("Template compose page found, but the template has not been saved yet");
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
            operationName: "templateDetail",
            dataName: "template",
            query: "query templateDetail($code: String!) {\n template(code: $code) {\n id\n code\n metadata\n config\n serializedConfig\n isV2Template\n }\n }",
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

        for (const service in currentTemplate.serializedConfig.services) {
            currentServices.push(currentTemplate.serializedConfig.services[service].name);
        };

        const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

        const sourceTemplateInputCode = tryTrim(prompt("Enter the template's short code that contains the service you want to embed into this template"));
        if (sourceTemplateInputCode == null) {
            alert("User canceled the prompt");
            return;
        };

        const [sourceTemplate, sourceTemplateError] = await gqlReq({
            operationName: "templateDetail",
            dataName: "template",
            query: "query templateDetail($code: String!) {\n template(code: $code) {\n id\n code\n metadata\n config\n serializedConfig\n isV2Template\n }\n }",
            variables: {
                "code": sourceTemplateInputCode
            },
        });

        if (sourceTemplateError != null) {
            alert("Error retrieving data for source template" + "\n" + sourceTemplateError);
            return;
        };

        if (!sourceTemplate.isV2Template) {
            alert("Not a v2 Template");
            return;
        };

        const sourceTemplateName = sourceTemplate.metadata.name;

        let sourceServicesMap = {};

        for (const service in sourceTemplate.serializedConfig.services) {
            sourceServicesMap[sourceTemplate.serializedConfig.services[service].name] = service
        };

        const sourceServices = Object.keys(sourceServicesMap);

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

        let newSerializedConfig = currentTemplate.serializedConfig;

        const uuid = crypto.randomUUID();

        newSerializedConfig.services[uuid] = sourceTemplate.serializedConfig.services[sourceServicesMap[serviceToEmbed]];

        let newVolumeMounts = {};

        for (const volume in newSerializedConfig.services[uuid].volumeMounts) {
            newVolumeMounts[uuid] = {
                "mountPath": newSerializedConfig.services[uuid].volumeMounts[volume].mountPath,
            };
        };

        delete newSerializedConfig.services[uuid].volumeMounts;

        newSerializedConfig.services[uuid]['volumeMounts'] = newVolumeMounts;

        const teamId = (params.has("teamId") == true) ? params.get("teamId") : null;

        htmlDoc.style.cursor = "wait";

        const [templateUpdateV2, templateUpdateV2Error] = await gqlReq({
            operationName: "templateUpdateV2",
            query: "mutation templateUpdateV2($id: String!, $input: TemplateCreateV2Input!) {\n templateUpdateV2(id: $id, input: $input) {\n id\n }\n}",
            variables: {
                "id": currentTemplateId,
                "input": {
                    "metadata": {
                        "name": currentTemplateName
                    },
                    "serializedConfig": newSerializedConfig,
                    "teamId": teamId
                }
            },
        });

        if (templateUpdateV2Error != null) {
            alert(`Error updating template ${currentTemplateName}` + "\n" + templateUpdateV2Error);
            return;
        };

        alert(`Service ${serviceToEmbed} embeded successfully`);

        location.reload();
    })();

    htmlDoc.style.cursor = null;
})();