(async () => {
    const response = await fetch("https://backboard.railway.com/graphql/internal", {
        headers: {
            "cache-control": "no-cache",
            "content-type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
            operationName: "GetMetalServices",
            query: "query GetMetalServices{regions{name railwayMetal}me{workspaces{team{projects{edges{node{id services{edges{node{id serviceInstances{edges{node{environmentId latestDeployment{meta environment{name}}}}}}}}}}}}}}}"
        }),
        mode: "cors",
        credentials: "include",
    });

    const data = await response.json();

    const metalRegions = data.data.regions
        .filter((region) => region.railwayMetal)
        .map((region) => region.name);

    const noMetalServices = data.data.me.workspaces
        .map((workspace) =>
            workspace.team.projects.edges.map((project) =>
                project.node.services.edges.map((service) =>
                    service.node.serviceInstances.edges.map((instance) => ({
                        regions: Object.keys(
                            instance.node.latestDeployment?.meta.serviceManifest.deploy
                                .multiRegionConfig ?? {},
                        ),
                        name: service.node.name,
                        projectName: project.node.name,
                        environmentName: instance.node.latestDeployment?.environment.name,
                        url: `https://railway.com/project/${project.node.id}/service/${service.node.id}/settings?environmentId=${instance.node.environmentId}`,
                    })),
                ),
            ),
        )
        .flat(3)
        .filter((services) => !services.regions.some((region) => metalRegions.includes(region)) && services.regions.length > 0);

    const formattedServices = noMetalServices
        .map((services) => `--\nname: ${services.name}\nproject: ${services.projectName}\nregion: ${services.regions.join(", ")}\nenvironment: ${services.environmentName}\n--`)
        .join("\n\n");

    const serviceUrls = noMetalServices.map(service => service.url).join("\n");

    const noMetalServicesString = `here's all non-metal services:\n\n${formattedServices}\nHere's the URLs:\n${serviceUrls}`;

    const blob = new Blob([noMetalServicesString], { type: 'text/plain' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'non-metal-services.txt';
    downloadLink.click();

    URL.revokeObjectURL(downloadLink.href);
})()
