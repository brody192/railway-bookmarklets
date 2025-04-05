javascript: (() => {
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

    const expression = prompt("Please enter your desired Cron Expression:", "*/15 * * * *");

    if (expression == null || expression == "") {
        alert("User cancelled the prompt");
        return;
    };

    const action = prompt("Please enter your Cron action ( restart | redeploy ):", "restart");

    if (action == null || action == "") {
        alert("User cancelled the prompt");
        return;
    };

    const schedule = `serviceID=${serviceID}&projectID=${projectID}&environmentID=${environmentID}&action=${action}&expression=${expression}`;

    const message = `Copy this configuration string into a service variable with a \`SCHEDULE_<number>\` variable name\n\n${schedule}`;

    const blob = new Blob([message], { type: 'text/plain' });

    const url = window.URL.createObjectURL(blob);

    window.open(url);
})();