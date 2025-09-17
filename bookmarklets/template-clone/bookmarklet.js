javascript: (async () => {
    if (window.location.origin != "https://railway.com") {
        alert("This bookmarklet is designed to be used with Railway");
        return;
    };

    const templatePageRegex = /^\/(?:template|deploy|new\/template)\/(.{3,})$/;

    const pathname = window.location.pathname;

    const templatePageMatch = templatePageRegex.exec(pathname);

    if (templatePageMatch == null) {
        alert("No template page found, do you have a template page open?");
        return;
    };

    let templateCode = "";

    const deployPageRegex = /^\/deploy\/(.{3,})$/;

    if (deployPageRegex.test(pathname)) {
        const href = document.evaluate(
            "//a[.//span[contains(text(), 'Deploy Now')]]/@href",
            document,
            null,
            XPathResult.STRING_TYPE,
            null
          ).stringValue;

          if (href == null || href == "") {
            alert("No Deploy Now button found, perhaps this bookmarklet needs updating?");
            return;
          };
          
          templateCode = href.split("/").pop();
    };

    const newTemplatePageRegex = /^\/new\/template\/(.{3,})$/;

    if (newTemplatePageRegex.test(pathname)) {
        templateCode = pathname.split("/").pop();
    };

    if (templateCode == "") {
        alert("No template code found, perhaps this bookmarklet needs updating?");
        return;
    };

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

    const confirmation = confirm(
        `This will clone the currently open template into your currently active workspace.\n\n` +
        `Continue with cloning?`
    );

    if (!confirmation) {
        return;
    };

    const styleId = "railway-bookmarklet-cursor";
    const cursorStyle = document.createElement("style");
    cursorStyle.id = styleId;
    cursorStyle.innerHTML = "* { cursor: wait !important; }";
    document.head.appendChild(cursorStyle);

    const [template, templateError] = await gqlReq({
        operationName: "templateDetail",
        dataName: "template",
        query: "query templateDetail($code: String) {\n  template(code: $code) {\n    ...TemplateFields\n  }\n}\n\nfragment TemplateFields on Template {\n  ...TemplateMetadataFields\n  id\n  code\n  createdAt\n  demoProjectId\n  workspaceId\n  config\n  serializedConfig\n  canvasConfig\n  status\n  isApproved\n  isVerified\n  communityThreadSlug\n  isV2Template\n  health\n  projects\n  recentProjects\n}\n\nfragment TemplateMetadataFields on Template {\n  name\n  description\n  image\n  category\n  readme\n  tags\n  languages\n  guides {\n    post\n    video\n  }\n}",
        variables: {
            "code": templateCode
        },
    });

    if (templateError != null) {
        document.getElementById(styleId)?.remove();
        alert("Error retrieving data on current template" + "\n" + templateError);
        return;
    };

    template.name = `${template.name} (Clone)`;

    const uuidMap = new Map();

    const serializedConfigWithNewUUIDs = JSON.parse(JSON.stringify(template.serializedConfig));

    if (serializedConfigWithNewUUIDs.services) {
        const newServices = {};
        
        for (const [serviceId, serviceConfig] of Object.entries(serializedConfigWithNewUUIDs.services)) {
            const newServiceId = crypto.randomUUID();
            uuidMap.set(serviceId, newServiceId);
            
            const newServiceConfig = serviceConfig;
            
            if (newServiceConfig.volumeMounts) {
                const newVolumeMounts = {};
                
                for (const [volumeId, volumeConfig] of Object.entries(newServiceConfig.volumeMounts)) {
                    let newVolumeId;
                    if (uuidMap.has(volumeId)) {
                        newVolumeId = uuidMap.get(volumeId);
                    } else {
                        newVolumeId = crypto.randomUUID();
                        uuidMap.set(volumeId, newVolumeId);
                    };
                    
                    newVolumeMounts[newVolumeId] = volumeConfig;
                };
                
                newServiceConfig.volumeMounts = newVolumeMounts;
            };
            
            newServices[newServiceId] = newServiceConfig;
        };
        
        serializedConfigWithNewUUIDs.services = newServices;
    };

    let canvasConfigWithNewUUIDs = null;
    if (template.canvasConfig) {
        canvasConfigWithNewUUIDs = JSON.parse(JSON.stringify(template.canvasConfig));
        
        if (canvasConfigWithNewUUIDs.positions) {
            const newPositions = {};
            
            for (const [positionId, positionConfig] of Object.entries(canvasConfigWithNewUUIDs.positions)) {
                const newPositionId = uuidMap.has(positionId) ? uuidMap.get(positionId) : positionId;
                newPositions[newPositionId] = positionConfig;
            };
            
            canvasConfigWithNewUUIDs.positions = newPositions;
        };
        
        if (canvasConfigWithNewUUIDs.groupRefs) {
            const newGroupRefs = {};
            
            for (const [groupId, serviceIds] of Object.entries(canvasConfigWithNewUUIDs.groupRefs)) {
                if (Array.isArray(serviceIds)) {
                    newGroupRefs[groupId] = serviceIds.map(id => uuidMap.has(id) ? uuidMap.get(id) : id);
                } else {
                    newGroupRefs[groupId] = serviceIds;
                }
            };
            
            canvasConfigWithNewUUIDs.groupRefs = newGroupRefs;
        };
    };

    const [templateUpsertConfig, templateUpsertConfigError] = await gqlReq({
        operationName: "templateUpsertConfig",
        query: "mutation templateUpsertConfig($id: String!, $input: TemplateUpsertConfigInput!) {\n  templateUpsertConfig(id: $id, input: $input) {\n    id\n    code\n  }\n}",
        variables: {
            "id": crypto.randomUUID(),
            "input": {
                "canvasConfig": canvasConfigWithNewUUIDs,
                "name": template.name,
                "metadata": template.metadata,
                "serializedConfig": serializedConfigWithNewUUIDs,
                "workspaceId": workspaceId,
            },
        },
    });

    if (templateUpsertConfigError != null) {
        document.getElementById(styleId)?.remove();
        alert(`Error cloning template` + "\n" + templateUpsertConfigError);
        return;
    };

    document.getElementById(styleId)?.remove();

    alert("Template cloned successfully");
})();