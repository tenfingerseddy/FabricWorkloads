import { bootstrap } from '@ms-fabric/workload-client';

function printFormattedAADErrorMessage(hashMessage: string): void {
    const hashString = hashMessage.slice(1);

    // Decode URL encoding and parse key-value pairs
    const searchParams = new URLSearchParams(hashString);
    const formattedMessage: Record<string, string> = {};

    searchParams.forEach((value, key) => {
        formattedMessage[key] = decodeURIComponent(value);
    });

    // Print formatted message
    document.documentElement.innerHTML = "There was a problem with the consent, open browser debug console for more details";
    for (const key in formattedMessage) {
        if (Object.prototype.hasOwnProperty.call(formattedMessage, key)) {
            console.error(`${key}: ${formattedMessage[key]}`);
        }
    }
}

/**
 * Authentication redirect handler.
 * Handles AAD redirect responses after consent flows.
 */
const redirectUriPath = '/close';
const url = new URL(window.location.href);
if (url.pathname?.startsWith(redirectUriPath)) {
    if (url?.hash?.includes("error")) {
        if (url.hash.includes("AADSTS650052")) {
            printFormattedAADErrorMessage(url?.hash);
        } else if (url.hash.includes("AADSTS65004")) {
            printFormattedAADErrorMessage(url?.hash);
        } else {
            window.close();
        }
    } else {
        window.close();
    }
}

console.log('****Runtime: Environment Variables****');
console.log('process.env.WORKLOAD_NAME: ' + process.env.WORKLOAD_NAME);
console.log('**************************************');

console.log('Observability Workbench: Starting bootstrap process...');
bootstrap({
    initializeWorker: (params) => {
        console.log('Observability Workbench: Initializing worker with params:', params);
        return import('./index.worker').then(({ initialize }) => {
            return initialize(params);
        });
    },
    initializeUI: (params) => {
        console.log('Observability Workbench: Initializing UI with params:', params);
        return import('./index.ui').then(({ initialize }) => {
            return initialize(params);
        });
    },
});
