#!/usr/bin/env nodejs
var http = require('http');
var fs = require('fs');
var express = require('express');
var app = express();
//var shelljs = require('shelljs/global');
app.use(express.static('./'));
var server = app.listen(8080);
