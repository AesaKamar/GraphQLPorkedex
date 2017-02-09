"use strict";
const _ = require("lodash");


// let statusArray = _.zipObject(_.range(1, 803), _.fill(Array(803), false));

let statusArray = _.chain(_.range(1, 803))
    .map((x) => { return { "NationalNumber": x, status: false } })
    .value()

console.log(JSON.stringify({ statuses: statusArray }));