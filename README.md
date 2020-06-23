# URL Query
This bundle queries features by an URL parameter.
So you are able to query features by their metadata and show them on app startup.

Sample App
------------------
* All countries, which ISO-code starts with 'F':
https://demos.conterra.de/mapapps/resources/apps/downloads_url_query/index.html?FeatureQuery={"ct_countries_1":{"filter":{"code":{"$eqw":"F*"}}}}
* All 'Good' water quality on 2014 in Belgium:
https://demos.conterra.de/mapapps/resources/apps/downloads_url_query/index.html?FeatureQuery={"bathingwater_1":{"filter":{"countryCode":{"$eqw":"BE"}}}}
* Combination of the first two examples:
https://demos.conterra.de/mapapps/resources/apps/downloads_url_query/index.html?FeatureQuery={"ct_countries_1":{"filter":{"code":{"$eqw":"F*"}}},"bathingwater_1":{"filter":{"countryCode":{"$eqw":"BE"}}}}
* Show only one feature, with additional information:
https://demos.conterra.de/mapapps/resources/apps/downloads_url_query/index.html?FeatureQuery={"bathingwater_1":{"filter":{"BWID":{"$eqw":"BE107760"}}}}

Installation Guide
------------------
**Requirement: map.apps 4.8.0**

The only step you need to do is to define the stores, which should be queryable.
For more information have a look at
https://docs.conterra.de/en/mapapps/latest/developersguide/concepts/complex-query.html

All other configuration is optional.

To enable notification and feature information, you have to enable the bundles ```notifier``` and ```featureinfo```.

#### Configurable Components of dn_urlquery

##### FeatureQueryResolver
```json
      "FeatureQueryResolver": {
        "notifications": false,
        "zoomToResults": {
          "activate": false,
          "factor": 1.25,
          "defaultScale": 5000
        },
        "autoInfo": true,
        "symbols": {
          "point": {
            "type": "esriPMS",
            ...
          },
          "polygon": {
            "type": "esriSFS",
            ...
          }
        },
        "stores": {
          "bathingwater_1": {
            "filter": {
              "qualityStatus_minus5": {
                "$eqw": "Good"
              }
            },
            "options": {
              "count": 50
            },
            "zoomToResults": {
              "activate": false
            }
          }
        }
      }
```

###### Configuration options
| Option                                 | Possible Values                 | Default                     | Description                                                                                                                                                                                                              |
|----------------------------------------|---------------------------------|-----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| notifications                          | ```true``` &#124; ```false```   | ```true```                  | Should notifications shown, if an error occurred, e.g. to many features were requested?                                                                                                                                  |
| zoomToResults.activate                 | ```true``` &#124; ```false```   | ```true```                  | Should be zoomed to all requested features?                                                                                                                                                                              |
| zoomToResults.factor                   | positive number                 | ```1```                     | A factor of the zoom extent, to get a border around all requested features                                                                                                                                               |
| zoomToResults.defaultScale             | positive integer                | ```25000```                 | The scale used, if no extent could created from the features                                                                                                                                                             |
| symbols.[featureType]                  | JSON object                     |                             | The styling information, how to render the features.<br>Show _symbolTable in <br> https://developernetwork.conterra.de/en/documentation/mapapps/38/developers-documentation/omni-search <br> for more information        |
| stores.[storeId].filter                | JSON object                     | ```{}```                    | Predefined filters, to limit the access to the features. <br> For more information have a look at <br> https://developernetwork.conterra.de/en/documentation/mapapps/38/developers-documentation/complex-query-dojostore |
| stores.[storeId].operator              | ```"$and"``` &#124; ```"$or"``` | ```"$and"```                | Logical operator to combine the predefined filters with the user-defined one.                                                                                                                                            |
| stores.[storeId].zoomToResults         | JSON object                     | default ```zoomToResults``` | Overrides the default zoomToResults to change the behavior of every store.                                                                                                                                               |
| stores.[storeId].symbols.[featureType] | JSON object                     | default ```symbols```       | Overrides the default symbols to change the styling of the features provides by this store                                                                                                                               |
| stores.[storeId].options.count         | positive integer                | infinitely                  | Defines the limit of requested features. If more returned, no feature will be shown.                                                                                                                                     |

Development Guide
------------------
### Define the mapapps remote base
Before you can run the project you have to define the mapapps.remote.base property in the pom.xml-file:
`<mapapps.remote.base>http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%</mapapps.remote.base>`

##### Other methods to to define the mapapps.remote.base property.
1. Goal parameters
`mvn install -Dmapapps.remote.base=http://%YOURSERVER%/ct-mapapps-webapp-%VERSION%`

2. Build properties
Change the mapapps.remote.base in the build.properties file and run:
`mvn install -Denv=dev -Dlocal.configfile=%ABSOLUTEPATHTOPROJECTROOT%/build.properties`
