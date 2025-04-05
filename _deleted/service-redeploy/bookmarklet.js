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

        if (serviceInstance.source == null || serviceInstance.source.image == null && serviceInstance.source.repo == null) {
            alert("This service has no source");
            return;
        };

        let serviceConnectInput = {};
        let extraInfo;

        if (serviceInstance.source.repo != null) {
            const [deploymentTriggers, deploymentTriggersError] = await gqlReq({
                operationName: "deploymentTriggers",
                query: "query deploymentTriggers($projectId: String!, $environmentId: String!, $serviceId: String!) {\n deploymentTriggers(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {\n edges {\n node {\n repository\n branch\n}\n}\n}\n}",
                variables: {
                    "projectId": projectID,
                    "serviceId": serviceID,
                    "environmentId": environmentID
                },
            });

            if (deploymentTriggersError != null) {
                alert("Get branch error" + "\n" + deploymentTriggersError);
                return;
            };

            if (deploymentTriggers.edges.length == 0) {
                alert("No branches found");
                return;
            };

            if (deploymentTriggers.edges.length > 1) {
                alert("Unknown state: more than one deployment trigger found");
                return;
            };

            serviceConnectInput = {
                "repo": deploymentTriggers.edges[0].node.repository,
                "branch": deploymentTriggers.edges[0].node.branch
            };

            extraInfo = "Repository: " + deploymentTriggers.edges[0].node.repository.split("/")[1] + "\n" + "Branch: " + deploymentTriggers.edges[0].node.branch;
        };

        if (serviceInstance.source.image != null) {
            serviceConnectInput = {
                "image": serviceInstance.source.image
            };

            extraInfo = "Image: " + serviceInstance.source.image;
        };

        const redeployConfirm = confirm("Redeploy the current service from the source?" + "\n" + extraInfo);
        if (redeployConfirm == false) {
            alert("User canceled the prompt");
            return;
        };

        const [_, serviceConnectError] = await gqlReq({
            operationName: "serviceConnect",
            query: "mutation serviceConnect($id: String!, $input: ServiceConnectInput!) {\n serviceConnect(id: $id, input: $input) {\n id\n}\n}",
            variables: {
                "id": serviceID,
                "input": serviceConnectInput
            },
        });

        if (serviceConnectError != null) {
            alert("Redeploy error" + "\n" + serviceConnectError);
            return;
        };

        alert("Trigged redeploy successfully");
    })();

    htmlDoc.style.cursor = null;
})();