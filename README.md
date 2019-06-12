# EWC Parity telemetry

Small NodeJS application to fetch information on new blocks from a Parity Ethereum node and pass it on to telegraf.

## Usage

1. Run `npm install` to install the dependencies
2. Set following environment variables to configure:

    - `WSURL` -> websocket to parity (eg. `ws://127.0.0.1:8546/`)
    - `HTTPURL` -> jsonrpc to parity (eg. `http://127.0.0.1:8545/`)
    - `PIPENAME` -> pipe/file to write metrics to (eg. `/tmp/output.pipe`)

3. Setup telegraf's `tail` pluigin as follows:

Change `/var/spool/parity.sock` to the path of the output pipe

```
[[inputs.tail]]
   files = ["/var/spool/parity.sock"]
   pipe = true
   data_format = "json"

   tag_keys = []
   json_time_key = "timekey"
   json_time_format = "unix_ms"
   json_string_fields = ["client","blockHash"]
   name_override = "parity"
```

4. Run the telemetry with `node src/index.js`
