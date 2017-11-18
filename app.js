"use strict";

// Config
const dotenv = require("dotenv");

dotenv.config({ silent: true });

const cfenv = require("cfenv");

const services = cfenv.getServices();

const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");

const getWeather = require("yahoo-weather");

const ConversationV1 = require("watson-developer-cloud/conversation/v1");

const conversationConfig = {
    username: process.env.WATSON_CONVERSATION_USERNAME,
    password: process.env.WATSON_CONVERSATION_PASSWORD,
    version_date: ConversationV1.VERSION_DATE_2017_05_26
};

// Use conversation credentials from cfenv when available.
if (services.conversation) {
    const { credentials } = services.conversation;

    Object.assign(conversationConfig, credentials);
}

const conversation = new ConversationV1(credentials);

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

/**
 *
 * @param {Array<{ entity: string, value: string, confidence: number }>} entities
 */
async function getWeatherReport(entities) {
    const { location, time } = entities.reduce(
        (acc, e) => {
            if (e.entity === "Time" && e.confidence > 0.8) {
                acc.time = e.value;
            }

            if (e.entity === "sys-location" && e.confidence > 0.8) {
                acc.location = e.value;
            }

            return acc;
        },
        { location: null, time: null }
    );

    const result = {
        messages: [],
        weatherReport: null
    };

    if (time && location) {
        result.messages.push(
            `Sorry, I don't know how to work with time yet. But, here's the weather for ${
                location
            }!`
        );
    }

    if (location) {
        result.weatherReport = await getWeather(location);

        return result;
    }
}

app.post("/api/message", (req, res) => {
    const { text, context } = req.body;

    conversation.message(
        {
            input: {
                text
            },
            context,
            workspace_id: process.env.WATSON_CONVERSATION_WORKSPACE_ID
        },
        (err, response) => {
            if (err) {
                console.error(err);
                res.json(500, response);
            } else {
                res.json(response);
            }
        }
    );
});

app.post("/api/weather", async (req, res) => {
    const { entities = [] } = req.body;

    if (!entities.length) {
        return res.status(400);
    }

    try {
        const weatherReport = await getWeatherReport(entities);

        return res.json(weatherReport);
    } catch (e) {
        console.error(e);
        return res.status(500);
    }
});

const port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;

app.listen(port, () => console.log("Server listening on", port));
