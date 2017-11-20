// Prevent globals by wrapping our code in a function.
// Notice: We don't use document.ready, or DOMContentLoaded,
// or equivalent, because this script is loaded asynchonously and
// with defer.
(function main() {
    // Hold a reference to the current Watson context.
    // Updated each time we get a response from Watson.
    let currentContext = null;

    /**
     * Reference to the chat input.
     *
     * @type {HTMLInputElement}
     */
    const input = document.querySelector("#chat-form-input");

    /**
     * Chat log.
     *
     * @type {HTMLDivElement}
     */
    const chatLog = document.querySelector("#chat-log");

    // Whenever the chat form submits, get the value from the input and
    // send a message to our server.
    // The server will then process the message and send it to Watson.
    document.querySelector("#chat-form").addEventListener("submit", async e => {
        e.preventDefault();

        const text = input.value.trim();

        // Don't submit when there's no text.
        if (!text) {
            return;
        }

        // Clear the input, and show the message on the chat log.
        input.value = "";

        printMessage(text, "mine");

        // Send the message to Watson via the server.
        await sendMessageAndShowResult(text);
    });

    // Prints the messages from Watson.
    async function parseWatsonMessage(data) {
        const { output = {} } = data;

        const { text = [] } = output;

        text.forEach(x => printMessage(x, "watson"));
    }

    /**
     * Gets the weather report when entities are matched by Watson.
     * Likely inneficient, but it works.
     *
     * @param {{ entities: any[] }} watsonResponse
     */
    async function getWeatherReport(watsonResponse) {
        const { entities } = watsonResponse;

        // When there are no entities matched, do nothing.
        if (!entities.length) {
            return;
        }

        // Get the weather.
        const response = await fetch("/api/weather", {
            method: "post",
            body: JSON.stringify({ entities }),
            headers: new Headers({
                "Content-Type": "application/json"
            })
        });

        if (response.status === 200) {
            // Everything went well, get the weather report and any messages,
            // and show them on the screen.
            const { messages, weatherReport } = await response.json();

            messages.forEach(m => printMessage(m, "watson"));

            printWeatherReport(weatherReport);
        } else {
            // Something went wrong.
            const { messages } = await response.json();
            messages.forEach(m => printMessage(m, "watson"));
        }
    }

    /**
     * Sends a message to Watson via the server and returns Watson's response.
     * @param {string} text
     */
    async function sendMessage(text) {
        // Send the message...
        const response = await fetch("/api/message", {
            method: "post",
            body: JSON.stringify({ text: text, context: currentContext }),
            headers: new Headers({
                "Content-Type": "application/json"
            })
        });

        const data = await response.json();

        if (response.status === 200) {
            // Save Watson's context for later...
            currentContext = data.context;
        } else {
            const text = await response.text();

            console.error(`Got status ${response.status}, response is ${text}`);
        }

        return data;
    }

    /**
     * Prints a message on the caht log.
     *
     * @param {string} text The message text.
     * @param {string} who Who sent this message: watson or the user.
     */
    function printMessage(text, who) {
        if (!text) {
            return;
        }

        const node = document.createElement("div");

        node.classList.add("chat-bubble", who);

        node.textContent = text;

        chatLog.appendChild(node);
    }

    /**
     * Prints a weather report on the chat log.
     *
     * @param {any} weatherReport
     */
    function printWeatherReport(weatherReport) {
        const { item, units, location } = weatherReport;
        const [today, ...rest] = item.forecast;

        const message = `It is currently ${item.condition.temp} º${
            units.temperature
        } and ${item.condition.text} in ${location.city}, with a high of ${
            today.high
        } and a low of ${today.low}.`;

        printMessage(message, "watson");

        printMessage(
            "This weather report courtesy of Yahoo! Weather and IBM Watson.",
            "watson"
        );
    }

    /**
     * Sends a message, waits for the response, and shows the response.
     * @param {string} text
     */
    async function sendMessageAndShowResult(text) {
        const message = await sendMessage(text);

        parseWatsonMessage(message);

        await getWeatherReport(message);
    }

    // Kickstart Watson by sending it an empty message. Triggers the "welcome"
    // node on the workspace.
    sendMessageAndShowResult("");
})();
