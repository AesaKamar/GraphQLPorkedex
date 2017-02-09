"use strict";
const _ = require("lodash");
const request = require("request");
const cheerio = require('cheerio')
const fs = require('fs');
const base64 = require("node-base64-image");
var he = require('he');

//get a list of statuses from the status.json file
let statuses = JSON.parse(fs.readFileSync('./data/status.json', 'utf8')).statuses;


//Filter out the statuses that have already passed
let failedParseAttempts = _.chain(statuses)
    .filter((x) => x.status == true)
    .value();


//Prepare pipeline for web scraping

ParsePokemonData(3);

function ParsePokemonData(pokedexNumber) {
    let hosturl = "http://www.serebii.net";
    let baseURL = "http://www.serebii.net/pokedex-sm/";
    request(baseURL + _.padStart(pokedexNumber, 3, '0') + ".shtml", (error, response, body) => {
        if (!error && response.statusCode == 200) {
            ///
            /// Main Parsing Logic
            ///
            let $ = cheerio.load(body)
            let mainContent = cheerio.load($.html('div[align="center"] div[align="center"]'));
            let sprite = base64.encode(hosturl + $(".dextab img").attr('src'), { string: true }, (err, res) => {
                sprite = res;
            });
            let abilities = _.chain(mainContent("p:nth-child(3) > table:nth-child(3) > tr:nth-child(4) > td:nth-child(3)"))
                .map((x) => _.chain(x.children)
                    .filter((x1, i) => i % 2 == 0)
                    .map((x1) => x1.data)
                    .map((x1) => /(\d) (.*) Point/.exec(x1))
                    .map((x1) => _.tail(x1))
                    .value()
                )
                .head()
                .map((x) => { return { "Type": _.last(x), "Value": _.toNumber(_.first(x)) } })
                .value();
            return [{
                // Based On Serebii Spec
                "Forms": [{
                    "Form Name": "Normal",
                    "Name": mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(2)").html(),
                    "Other Names": _.chain(mainContent("p:nth-child(3) > table:nth-child(2) tr:nth-child(2) > td:nth-child(3) tr").toArray())
                        .map((x) => $(x).text())
                        .map((x) => _.split(_.trimStart(x), ':'))
                        .map((x) => { return { "Country": _.head(x), "Name": _.last(x) } })
                        .value(),
                    "NationalNumber": pokedexNumber,
                    "Sprite": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                    "Picture": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                    "Shiny Picture": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                    "Type": _.chain(mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(2) td.cen a"))
                        .map((x) => $(x).attr('href'))
                        .map((x) => /\/(\w*)\.shtml/.exec(x))
                        .map((x) => _.last(x))
                        .value(),
                    "Classification": he.decode(mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(4) > td:nth-child(1)").html()),
                    "Height": _.chain(mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(4) > td:nth-child(2)"))
                        .map((x) => _.last(x.children).data)
                        .map((x) => _.last(/(\d*\.\d)*m/.exec(x)))
                        .first()
                        .toNumber()
                        .value(),
                    "Weight": _.chain(mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(4) > td:nth-child(3)"))
                        .map((x) => _.last(x.children).data)
                        .map((x) => _.last(/(\d*\.\d)*kg/.exec(x)))
                        .first()
                        .toNumber()
                        .value(),
                    "Capture Rate": _.chain(mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(4) > td:nth-child(4)").html())
                        .toNumber()
                        .value(),
                    "Base Egg Steps": _.chain(mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(4) > td:nth-child(5)").html())
                        .replace(',', '')
                        .toNumber()
                        .value(),
                    "Abilities": _.chain(mainContent("p:nth-child(3) > table:nth-child(3) > tr:nth-child(2) a > b"))
                        .map((x) => $(x).text())
                        .value(),
                    "Growth Rate": _.chain(mainContent("p:nth-child(3) > table:nth-child(3) > tr:nth-child(4) > td:nth-child(1)"))
                        .map((x) => $(x).text())
                        .map((x) => /Points(.*)/.exec(x))
                        .map((x) => _.last(x))
                        .value(),
                    "Base Happiness": _.chain(mainContent("p:nth-child(3) > table:nth-child(3) > tr:nth-child(4) > td:nth-child(2)").html())
                        .toNumber()
                        .value(),
                    "EV Yield": _.chain(mainContent("p:nth-child(3) > table:nth-child(3) > tr:nth-child(4) > td:nth-child(3)"))
                        .map((x) => _.chain(x.children)
                            .filter((x1, i) => i % 2 == 0)
                            .map((x1) => x1.data)
                            .map((x1) => /(\d) (.*) Point/.exec(x1))
                            .map((x1) => _.tail(x1))
                            .value()
                        )
                        .head()
                        .map((x) => { return { "Type": _.last(x), "Value": _.toNumber(_.first(x)) } })
                        .value(),
                    "Egg Groups": ["Grass", "Monster"],
                    "Gender": { "Male": 87.5, "Female": 12.5 },
                    "HP": 45,
                    "Attack": 49,
                    "Defense": 49,
                    "Special Attack": 65,
                    "Special Defense": 65,
                    "Speed": 45,
                    "BaseStatTotal": 318,
                    "Pokedex Entries": [
                        { "Game": "Entry" },
                        { "Game": "Entry" }
                    ]

                }]

            }]
        } else {
            return [];
        }
    })
}