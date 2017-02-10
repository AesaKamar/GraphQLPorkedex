"use strict";
const _ = require("lodash");


let highestReached = 112;

let goodStatusArray = _.chain(_.range(1, highestReached + 1))
    .map((x) => { return { "NationalNumber": x, status: true } })
    .value();
let badStatusArray = _.chain(_.range(highestReached + 1, 803))
    .map((x) => { return { "NationalNumber": x, status: false } })
    .value();
let statusArray = _.concat(goodStatusArray, badStatusArray);

console.log(JSON.stringify({ statuses: statusArray }));