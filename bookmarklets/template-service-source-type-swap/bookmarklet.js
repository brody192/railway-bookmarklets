javascript: (async () => {
    await (async () => {
        if (window.location.origin != "https://railway.com") {
            alert("This bookmarklet is designed to be used with Railway");
            return;
        };

        const pathRegex = /^\/workspace\/templates\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/service\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

        const pathname = window.location.pathname;

        const match = pathname.match(pathRegex);

        if (!match) {
            alert("Template service page not found. Please open a template service page with URL format: /workspace/templates/<uuid>/service/<uuid>");
            return;
        };

        const currentTemplateId = match[1];
        const currentServiceId = match[2];

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

        const currentService = currentTemplate.serializedConfig.services[currentServiceId];
        
        if (!currentService) {
            alert(`Service with ID ${currentServiceId} not found in template`);
            return;
        };

        const currentServiceName = currentService.name;
        const currentSource = currentService.source;

        const tryTrim = (input) => (typeof input == "string") ? input.trim() : input;

        let newSource = {};
        let promptMessage = "";
        let confirmMessage = "";

        if (currentSource.image) {
            promptMessage = `Current source is an image: ${currentSource.image}\n\nEnter the GitHub repository (format: owner/repo or full URL):`;
            
            const repoInput = tryTrim(prompt(promptMessage));
            if (repoInput == null) {
                alert("User canceled the prompt");
                return;
            };

            let repo = repoInput;
            if (repo.includes("github.com/")) {
                const urlMatch = repo.match(/github\.com\/([^\/]+\/[^\/]+)/);
                if (urlMatch) {
                    repo = urlMatch[1].replace(/\.git$/, '');
                };
            };

            newSource = {
                repo: repo,
                branch: null,
                rootDirectory: null
            };

            confirmMessage = `Swap source type for service "${currentServiceName}"?\n\nFrom: Image (${currentSource.image})\nTo: Repository (${repo})\n\nThis will clear any unsaved changes`;

        } else if (currentSource.repo) {
            const currentRepoDisplay = `${currentSource.repo}${currentSource.branch ? ` (${currentSource.branch})` : ''}`;
            promptMessage = `Current source is a repository: ${currentRepoDisplay}\n\nEnter the Docker image:`;
            
            const imageInput = tryTrim(prompt(promptMessage));
            if (imageInput == null) {
                alert("User canceled the prompt");
                return;
            };

            newSource = {
                image: imageInput
            };

            confirmMessage = `Swap source type for service "${currentServiceName}"?\n\nFrom: Repository (${currentSource.repo})\nTo: Image (${imageInput})\n\nThis will clear any unsaved changes`;

        } else {
            alert("Service has an unknown source type");
            return;
        };

        const proceed = confirm(confirmMessage);
        if (proceed == false) {
            alert("User canceled the operation");
            return;
        };

        let newSerializedConfig = JSON.parse(JSON.stringify(currentTemplate.serializedConfig));
        
        newSerializedConfig.services[currentServiceId].source = newSource;

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

        let successMessage = `Source type swapped successfully for service "${currentServiceName}"`;
        
        if (newSource.image) {
            successMessage += `\n\nNew source: Image (${newSource.image})`;
        } else if (newSource.repo) {
            successMessage += `\n\nNew source: Repository (${newSource.repo})`;
        };

        document.getElementById(styleId)?.remove();
        
        alert(successMessage);

        location.reload();
    })();

    document.getElementById(styleId)?.remove();
})();