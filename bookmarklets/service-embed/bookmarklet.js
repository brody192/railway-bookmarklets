javascript: (async () => {
    await (async () => {
        if (window.location.origin != "https://railway.com") {
            alert("This bookmarklet is designed to be used with Railway");
            return;
        };

        const pathRegex = /^\/workspace\/templates\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

        const pathname = window.location.pathname;

        const match = pathname.match(pathRegex);

        if (!match) {
            alert("Template editor page not found, do you have an edit page open?");
            return;
        };

        const currentTemplateId = match[1];

        const workspaceLocalStorageValue = localStorage.getItem("@railway/dashboard/workspace");

        if (workspaceLocalStorageValue == null) {
            alert("Current workspace ID not found, perhaps this bookmarklet needs updating?");
            return;
        };

        const workspaceId = workspaceLocalStorageValue.split('"').join('');

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
            dataName: "template",
            query: "query template($owner: String, $repo: String, $code: String, $id: String) {\n  template(owner: $owner, repo: $repo, code: $code, id: $id) {\n    ...TemplateFields\n  }\n}\n\nfragment TemplateFields on Template {\n  ...TemplateMetadataFields\n  id\n  code\n  createdAt\n  demoProjectId\n  workspaceId\n  config\n  serializedConfig\n  canvasConfig\n  status\n  isApproved\n  isVerified\n  communityThreadSlug\n  isV2Template\n  health\n  projects\n  recentProjects\n}\n\nfragment TemplateMetadataFields on Template {\n  name\n  description\n  image\n  category\n  readme\n  tags\n  languages\n  guides {\n    post\n    video\n  }\n}",
            variables: {
                "id": currentTemplateId
            },
        });

        if (currentTemplateError != null) {
            alert("Error retrieving data on current template" + "\n" + currentTemplateError);
            return;
        };

        const currentTemplateName = currentTemplate.name;

        let currentServiceNames = [];
        let currentServiceIds = [];

        for (const serviceId in currentTemplate.serializedConfig.services) {
            currentServiceNames.push(currentTemplate.serializedConfig.services[serviceId].name);
            currentServiceIds.push(serviceId);
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
            query: "query templateDetail($code: String!) {\n template(code: $code) {\n id\n code\n createdAt\n metadata\n config\n serializedConfig\n status\n isApproved\n isV2Template\n health\n projects\n services {\n edges {\n node {\n id\n config\n }\n }\n }\n activeProjects\n creator {\n name\n avatar\n username\n hasPublicProfile\n }\n }\n }",
            variables: {
                "code": sourceTemplateInputCode
            },
        });

        if (sourceTemplateError != null) {
            alert("Error retrieving data for source template" + "\n" + sourceTemplateError);
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
        let servicesByNumber = {};

        sourceServiceList += `[*] Add All Services (${sourceServices.length} services)\n`;
        sourceServiceList += `---\n`;

        for (const [i, service] of sourceServices.entries()) {
            const num = i + 1;
            servicesByNumber[num.toString()] = service;
            sourceServiceList += `[${num}] ${service}`;
            if (i < sourceServices.length - 1) sourceServiceList += "\n";
        };

        const serviceInput = tryTrim(prompt(`Enter service name(s), number(s), or * for all. Use commas for multiple (e.g., 1,3 or frontend,backend)\n${sourceServiceList}`, defaultService));
        if (serviceInput == null) {
            alert("User canceled the prompt");
            return;
        };

        const isAddAll = serviceInput === "*" || serviceInput.toLowerCase() === "all";
        
        if (serviceInput.includes(",") && (serviceInput.includes("*") || serviceInput.toLowerCase().includes("all"))) {
            alert(`Cannot mix "*" or "all" with other selections. Use "*" or "all" alone to add all services, or specify individual services.`);
            return;
        };
        
        let servicesToEmbed = [];
        
        if (isAddAll) {
            servicesToEmbed = sourceServices;
        } else {
            const selections = serviceInput.split(",").map(s => s.trim()).filter(s => s.length > 0);
            
            if (selections.length === 0) {
                alert("No services selected");
                return;
            };
            
            for (const selection of selections) {
                let serviceToEmbed = selection;
                
                if (servicesByNumber[selection]) {
                    serviceToEmbed = servicesByNumber[selection];
                };
                
                if (!sourceServices.includes(serviceToEmbed)) {
                    alert(`Service "${selection}" does not exist within the source template ${sourceTemplateName}`);
                    return;
                };
                
                
                if (!servicesToEmbed.includes(serviceToEmbed)) {
                    servicesToEmbed.push(serviceToEmbed);
                };
            };
        };

        let confirmMessage;
        if (isAddAll) {
            confirmMessage = `Proceed with embedding ALL ${servicesToEmbed.length} services into this template?\n\nServices to add:\n${servicesToEmbed.join(", ")}\n\nThis will clear any unsaved changes`;
        } else if (servicesToEmbed.length > 1) {
            confirmMessage = `Proceed with embedding ${servicesToEmbed.length} services into this template?\n\nServices to add:\n${servicesToEmbed.join(", ")}\n\nThis will clear any unsaved changes`;
        } else {
            confirmMessage = `Proceed with embedding service ${servicesToEmbed[0]} into this template?\nThis will clear any unsaved changes`;
        };
        
        const proceed = confirm(confirmMessage);
        if (proceed == false) {
            alert("User canceled the prompt");
            return;
        };

        let newSerializedConfig = currentTemplate.serializedConfig;

        let renamedServices = [];
        
        for (const serviceToEmbed of servicesToEmbed) {
            const sourceServiceId = sourceServicesMap[serviceToEmbed];
            const uuid = crypto.randomUUID();

            if (currentServiceIds.includes(sourceServiceId)) {
                alert(`Service with ID ${sourceServiceId} already exists in the current template. Skipping.`);
                continue;
            };

            newSerializedConfig.services[uuid] = {...sourceTemplate.serializedConfig.services[sourceServiceId]};

            let serviceName = newSerializedConfig.services[uuid].name;
            if (currentServiceNames.includes(serviceName)) {
                const originalName = serviceName;
                const timeMid = uuid.split('-')[1];
                serviceName = `${serviceName}-${timeMid}`;
                newSerializedConfig.services[uuid].name = serviceName;
                renamedServices.push(`${originalName} → ${serviceName}`);
            };
            currentServiceNames.push(serviceName);

            let newVolumeMounts = {};

            for (const volume in newSerializedConfig.services[uuid].volumeMounts) {
                newVolumeMounts[uuid] = {
                    "mountPath": newSerializedConfig.services[uuid].volumeMounts[volume].mountPath,
                };
            };

            delete newSerializedConfig.services[uuid].volumeMounts;

            newSerializedConfig.services[uuid]['volumeMounts'] = newVolumeMounts;
        };

        const styleId = "railway-bookmarklet-cursor";
        const cursorStyle = document.createElement("style");
        cursorStyle.id = styleId;
        cursorStyle.innerHTML = "* { cursor: wait !important; }";
        document.head.appendChild(cursorStyle);

        const [templateUpsertConfig, templateUpsertConfigError] = await gqlReq({
            operationName: "templateUpsertConfig",
            query: "mutation templateUpsertConfig($id: String!, $input: TemplateUpsertConfigInput!) {\n  templateUpsertConfig(id: $id, input: $input) {\n    id\n    code\n  }\n}",
            variables: {
                "id": currentTemplateId,
                "input": {
                    "canvasConfig": currentTemplate.canvasConfig,
                    "name": currentTemplateName,
                    "serializedConfig": newSerializedConfig,
                    "workspaceId": workspaceId
                }
            },
        });

        if (templateUpsertConfigError != null) {
            document.getElementById(styleId)?.remove();
            alert(`Error updating template ${currentTemplateName}` + "\n" + templateUpsertConfigError);
            return;
        };

        let successMessage;
        if (isAddAll) {
            successMessage = `All ${servicesToEmbed.length} services embedded successfully`;
        } else if (servicesToEmbed.length > 1) {
            successMessage = `${servicesToEmbed.length} services embedded successfully: ${servicesToEmbed.join(", ")}`;
        } else {
            successMessage = `Service ${servicesToEmbed[0]} embedded successfully`;
        };

        if (renamedServices.length > 0) {
            successMessage += `\n\nRenamed services to avoid conflicts:\n${renamedServices.join("\n")}`;
        };

        document.getElementById(styleId)?.remove();
        
        alert(successMessage);

        location.reload();
    })();

    document.getElementById(styleId)?.remove();
})();