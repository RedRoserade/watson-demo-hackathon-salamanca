"use strict";

// Config
const dotenv = require("dotenv");

// @ts-ignore
dotenv.config({ silent: true });

const cfenv = require("cfenv");

// @ts-ignore
const appEnv = cfenv.getAppEnv();

const services = appEnv.getServices();

const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");

const getWeather = require("yahoo-weather");

const ConversationV1 = require("watson-developer-cloud/conversation/v1");

const watsonConversationServiceName =
    process.env.WATSON_CONVERSATION_SERVICE_NAME;

const conversationConfig = {
    username: process.env.WATSON_CONVERSATION_USERNAME,
    password: process.env.WATSON_CONVERSATION_PASSWORD,
    version_date: ConversationV1.VERSION_DATE_2017_05_26
};

// Use conversation credentials from cfenv when available.
if (services[watsonConversationServiceName]) {
    const { credentials } = services[watsonConversationServiceName];

    Object.assign(conversationConfig, credentials);
}

const conversation = new ConversationV1(conversationConfig);

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
            if (e.entity === "Time") {
                acc.time = e.value;
            }

            if (e.entity === "sys-location") {
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
    }

    return result;
}

const conversationId = process.env.WATSON_CONVERSATION_WORKSPACE_ID;

app.post("/api/message", (req, res) => {
    const { text, context } = req.body;

    conversation.message(
        {
            input: {
                text
            },
            context,
            workspace_id: conversationId
        },
        (err, response) => {
            if (err) {
                console.error(err);
                res.status(500).json({
                    output: {
                        text: [
                            "Sorry, but something went wrong. Could you try again?"
                        ]
                    }
                });
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
        return res.status(500).json({
            messages: [
                "Sorry, but I couldn't get the weather. Could you try again?"
            ],
            weatherReport: null
        });
    }
});

const port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;

app.listen(port, () => console.log("Server listening on", port));
