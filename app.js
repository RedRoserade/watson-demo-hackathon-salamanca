// This code is for the backend part of the application.
// It takes care of configuring connections to Watson and receiving messages
// from the web page.

"use strict";

const path = require("path");

// Configuration. This uses the ".env" file, it reads variables from it
// and saves them in process.env.
const dotenv = require("dotenv");

// @ts-ignore
dotenv.config({ silent: true });

// When running on Bluemix, we're running using Cloud Foundry.
// cfenv allows us easy access to configuration variables from services
// that we added to our app.
const cfenv = require("cfenv");

// Express is our web server. It's easy to configure and extremely powerful.
const express = require("express");

// We'll use this to read data sent by the web page.
const bodyParser = require("body-parser");

// Simple function that allows us to get weather forecasts
// from Yahoo! Weather for a city.
const getWeather = require("yahoo-weather");

// Watson Conversation SDK.
const ConversationV1 = require("watson-developer-cloud/conversation/v1");

// Configuration for Watson's conversation SDK
const conversationConfig = {
    username: process.env.WATSON_CONVERSATION_USERNAME,
    password: process.env.WATSON_CONVERSATION_PASSWORD,
    version_date: ConversationV1.VERSION_DATE_2017_05_26
};

const conversationId = process.env.WATSON_CONVERSATION_WORKSPACE_ID;

// Get the services from Cloud Foundry (cfenv). This fails silently if
// we're not running on Bluemix.

// @ts-ignore
const appEnv = cfenv.getAppEnv();

const services = appEnv.getServices();

const watsonConversationServiceName =
    process.env.WATSON_CONVERSATION_SERVICE_NAME;

// Use conversation credentials from cfenv when available.
if (services[watsonConversationServiceName]) {
    const { credentials } = services[watsonConversationServiceName];

    Object.assign(conversationConfig, credentials);
}

// This object will be used to talk to Watson.
const conversation = new ConversationV1(conversationConfig);

// Create the server and configure it.
const app = express();

// Any file inside the "public" folder will be served as-is.
app.use(express.static(path.join(__dirname, "public")));

// Allow Express to read data from the page.
app.use(bodyParser.json());

/**
 * Parses the matched entities from Watson and gets the weather for a city,
 * along any messages.
 *
 * @param {Array<{ entity: string, value: string, confidence: number }>} entities
 * @returns {Promise<{ messages: string[], weatherReport: any }>}
 */
async function getWeatherReport(entities) {
    // Entities is an array. We want to extract the time and
    // the sys-location entities from it.
    // We convert the array into an object on the process,
    // makes things easier to work with.
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
        // To hold any messages that may occur.
        messages: [],
        // To hold the weather report.
        weatherReport: null
    };

    // I'll leave this as an exercise for the reader :)
    if (time && location) {
        result.messages.push(
            `Sorry, I don't know how to work with time yet. But, here's the weather for ${
                location
            }!`
        );
    }

    // Get the weather for the location.
    if (location) {
        result.weatherReport = await getWeather(location);
    }

    return result;
}

// This endpoint will respond to messages from the page.
app.post("/api/message", (req, res) => {
    // Get the text, and the Watson context from the request.
    // The context is needed so that Watson knows the string of messages
    // that led here.
    const { text, context } = req.body;

    // Send a message to watson, and wait for the response.
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
                // Error handling.

                console.error(err);

                res.status(500).json({
                    output: {
                        text: [
                            "Sorry, but something went wrong. Could you try again?"
                        ]
                    }
                });
            } else {
                // Send the output to Watson as-is.
                res.json(response);
            }
        }
    );
});

// This endpoint will fetch a weather report for the matched entities.
app.post("/api/weather", async (req, res) => {
    const { entities = [] } = req.body;

    // Validation. We can't get a weather report without data for it.
    if (!entities.length) {
        return res.status(400);
    }

    try {
        // Get the weather report from the API, and return it.
        const weatherReport = await getWeatherReport(entities);

        return res.json(weatherReport);
    } catch (e) {
        // Error handling.
        console.error(e);
        return res.status(500).json({
            messages: [
                "Sorry, but I couldn't get the weather. Could you try again?"
            ],
            weatherReport: null
        });
    }
});

// Configure the port that the app will listen on...
const port = process.env.PORT || process.env.VCAP_APP_PORT || 3000;

// And start it. Once it's started, you'll see "Server listening on <port>" on the console.
app.listen(port, () => console.log("Server listening on", port));
