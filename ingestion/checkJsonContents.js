"use strict";
const _ = require("lodash");
const fs = require('fs');



let allFiles = fs.readdirSync("./data/pokemon_json")

let allPresentFiles = _.chain(allFiles)
    .map((x) => _.chain(x)
        .split('.')
        .first()
        .toInteger()
        .value())
    .sort()
    .value();

let allPossibleFiles = _.chain(_.range(1, 803))
    .value();
let diff = _.difference(allPossibleFiles, allPresentFiles);



let output = _.chain(diff)
    .map((x) => { return { "NationalNumber": x, status: false } })
    .value()

fs.writeFileSync('./data/status.json', JSON.stringify({ "statuses": output }));

debugger;