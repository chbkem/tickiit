# Pull request checklist

Before you merge, confirm the states on any screen you added or changed.

* [ ] New or changed data views cover loading, error, empty and ready.
* [ ] Loading uses the shared skeleton or ViewState, never a bare spinner or a blank area.
* [ ] Refresh keeps existing content on screen and shows the small busy indicator.
* [ ] Errors use friendlyError, raw messages stay in the console, and retry is manual.
* [ ] Empty results say whether there is no data or no filter match, with the right action.
* [ ] Mutation feedback uses short, aligned toast copy or an inline alert.
* [ ] Client tests and the client build pass.
