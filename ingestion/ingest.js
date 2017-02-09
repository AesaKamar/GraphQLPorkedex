"use strict";
const _ = require("lodash");
const Promise = require("bluebird");
const fs = require('fs');
const jsonfile = require('jsonfile-promised')
const request = require("request-promise");
const cheerio = require('cheerio')
const he = require('he');
const base64 = require("node-base64-image");
const ProgressBar = require('progress');

//get a list of statuses from the status.json file
/**
 * @function getStatusList
 * @return {type} {description}
 */
function getStatusList() { return JSON.parse(fs.readFileSync('./data/status.json', 'utf8')).statuses };
/**
 * @function setStatusList
 * @param  {statusArray} statusObject {description}
 * @return {type} {description}
 */
function setStatusList(statusObject) { fs.writeFileSync('./data/status.json', JSON.stringify(statusObject)) }

//Filter out the statuses that have already passed
let pendingParsingList = _.chain(getStatusList())
    .filter((x) => x.status == false)
    .take(1)
    .value();

var bar = new ProgressBar(':bar', { total: _.size(pendingParsingList) });

//Prepare pipeline for web scraping
//Once a promise is 
let folderToWriteTo = "./data/pokemon_json/"
    //For All attempts that failed or haven't been completed
let completedParsingList = (() => Promise.map(pendingParsingList, (parseAttempt) => {
        bar.tick();
        //Parse the data 
        return ParsePokemonDataPromise(parseAttempt.NationalNumber).then((res) => {
            //Then Write the results to disk. We need the dex no for the file
            return jsonfile.writeFile(folderToWriteTo + _.padStart(parseAttempt.NationalNumber, 3, '0') + ".json", res)
                //Report Success
                .then((res) => new Promise((resolve, reject) =>
                        resolve({ "NationalNumber": parseAttempt.NationalNumber, "status": true })),
                    (err) => {})
                //Report Error
        }, (err) => new Promise((resolve, reject) => reject({ "NationalNumber": parseAttempt.NationalNumber, "status": false })))

    }, { concurrency: 2 })
    .then((res) => {
        //Compare the completed parsing list and the pending one
        let mergedList = _.merge(getStatusList(), res)
        setStatusList(mergedList);
        debugger;
    }, (err) => {
        debugger;
    }))();



/**
 * @function ParsePokemonDataPromise 
 * @param  {number} pokedexNumber {The National Dex Number of the pokemon you want to retrieve}
 * @return {Promise} {Containes a Pokemon JSON Record}
 * @description {Parses Pokemon data from serebii}
 */
function ParsePokemonDataPromise(pokedexNumber) {
    let hosturl = "http://www.serebii.net";
    let baseURL = "http://www.serebii.net/pokedex-sm/";
    return request(baseURL + _.padStart(pokedexNumber, 3, '0') + ".shtml")
        .then((body) => {

            ///
            /// Main Parsing Logic
            ///
            let $ = cheerio.load(body)
            let mainContent = cheerio.load($.html('div[align="center"] div[align="center"]'));

            //Images ned to have their promise resolved
            let imagePromises = [];
            imagePromises.push(new Promise((resolve, reject) => {
                base64.encode(hosturl + $(".dextab img").attr('src'), { string: true }, (err, res) => resolve(res));
            }));
            imagePromises.push(new Promise((resolve, reject) => {
                base64.encode(hosturl + $("p:nth-child(3) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(1) .pkmn img").attr('src'), { string: true }, (err, res) => resolve(res));
            }));
            imagePromises.push(new Promise((resolve, reject) => {
                base64.encode(hosturl + $("p:nth-child(3) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(2) .pkmn img").attr('src'), { string: true }, (err, res) => resolve(res));
            }));

            //Once Promises are resolved, map them to an object and resolve it
            let imageScrapingResult = Promise.all(imagePromises)
                .then((res) => {
                        return new Promise((resolve, reject) => resolve({
                            "Forms": [{
                                "Form Name": "Normal",
                                "Sprite": _.nth(res, 0),
                                "Picture": _.nth(res, 1),
                                "Shiny Picture": _.nth(res, 2),
                            }]
                        }));
                    },
                    (err) => {});

            let textScrapingResult = new Promise((resolve, reject) => {
                resolve({
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
                        // "Sprite": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                        // "Picture": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
                        // "Shiny Picture": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
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
                        "Egg Groups": _.chain(mainContent("p:nth-child(3) > table:nth-child(5)  tr:nth-child(2) td:nth-child(2) .dexitem"))
                            // .map((x) => _.chain(x.children))
                            .map((x) => _.map($(x).find('tr > td:nth-child(2)'), (x) =>
                                $(x).text()))
                            .head()
                            .value(),
                        "Gender Rates": _.chain(mainContent("p:nth-child(3) > table:nth-child(2) > tr:nth-child(2) > td:nth-child(5) tr"))
                            .map((x) => $(x).text())
                            .map((x) => _.chain(/(\w*)\s*.:(\d*\.?\d*)%/.exec(x))
                                .value()
                            )
                            .map((x) => { return { "Gender": _.nth(x, 1), "Rate": _.toNumber(_.nth(x, 2)) } })
                            .value(),
                        "HP": _.chain($('a[name="stats"] + table tr:nth-child(3) td:nth-child(2)').text())
                            .toNumber()
                            .value(),
                        "Attack": _.chain($('a[name="stats"] + table tr:nth-child(3) td:nth-child(3)').text())
                            .toNumber()
                            .value(),
                        "Defense": _.chain($('a[name="stats"] + table tr:nth-child(3) td:nth-child(4)').text())
                            .toNumber()
                            .value(),
                        "Special Attack": _.chain($('a[name="stats"] + table tr:nth-child(3) td:nth-child(5)').text())
                            .toNumber()
                            .value(),
                        "Special Defense": _.chain($('a[name="stats"] + table tr:nth-child(3) td:nth-child(6)').text())
                            .toNumber()
                            .value(),
                        "Speed": _.chain($('a[name="stats"] + table tr:nth-child(3) td:nth-child(7)').text())
                            .toNumber()
                            .value(),
                        "BaseStatTotal": _.chain($('a[name="stats"] + table tr:nth-child(3) td:nth-child(1)').text())
                            .thru((x) => /(\d+)/.exec(x))
                            .last()
                            .toNumber()
                            .value(),
                        // "Pokedex Entries": [
                        //     { "Game": "Entry" },
                        //     { "Game": "Entry" }
                        // ]
                    }]
                })
            });

            //Once picture and text scrapings have resolved, merge the objects and resolve them
            return Promise.all([imageScrapingResult, textScrapingResult])
                .then((res) => {

                    let final = _.merge(_.nth(res, 1), _.nth(res, 0));
                    return new Promise((resolve, reject) => resolve(final))

                }, (err) => new Promise((resolve, reject) => reject(null)))
                .catch((err) => new Promise((resolve, reject) => reject(null)))

        })
        .catch((err) => new Promise((resolve, reject) => reject(null)))
}



let EXITCONDITION = false;
/**
 * @function wait
 * @return {void} {returns nothing}
 * @description {prevents application from quitting prematurely}
 */
function wait() {
    if (!EXITCONDITION)
        setTimeout(wait, 1000);
};
wait();