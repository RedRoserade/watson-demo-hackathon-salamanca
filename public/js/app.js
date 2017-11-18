(function main() {
    let currentContext = null;

    const input = document.querySelector("#chat-form-input");

    const chatLog = document.querySelector("#chat-log");

    document.querySelector("#chat-form").addEventListener("submit", async e => {
        e.preventDefault();

        const text = input.value.trim();

        if (!text) {
            return;
        }

        input.value = "";

        printMessage(text, "mine");

        await sendMessageAndShowResult(text);
    });

    async function parseWatsonMessage(data) {
        const { output = {} } = data;

        const { text = [] } = output;

        text.forEach(x => printMessage(x, "watson"));
    }

    async function getWeatherReport(watsonResponse) {
        const { entities } = watsonResponse;

        if (!entities.length) {
            return;
        }

        const response = await fetch("/api/weather", {
            method: "post",
            body: JSON.stringify({ entities }),
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (response.status === 200) {
            const { messages, weatherReport } = await response.json();

            messages.forEach(m => printMessage(m, "watson"));

            printWeatherReport(weatherReport);
        }
    }

    async function sendMessage(text) {
        const response = await fetch("/api/message", {
            method: "post",
            body: JSON.stringify({ text: text, context: currentContext }),
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (response.status === 200) {
            const data = await response.json();

            currentContext = data.context;

            return data;
        } else {
            const text = await response.text();

            throw new Error(
                `Got status ${response.status}, response is ${text}`
            );
        }
    }

    function printMessage(text, who) {
        if (!text) {
            return;
        }

        const node = document.createElement("div");

        node.classList.add("chat-bubble", who);

        node.textContent = text;

        chatLog.insertBefore(node, chatLog.firstChild);
    }

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

    async function sendMessageAndShowResult(text) {
        const message = await sendMessage(text);

        parseWatsonMessage(message);

        await getWeatherReport(message);
    }

    sendMessageAndShowResult("");
})();
