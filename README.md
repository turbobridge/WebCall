# WebCall

WebCall is a TurboBridge reference WebRTC conferencing client implementation. It is the same implementation which is available to TurboBridge customers on https://www.turbobridge.com/webcall/. TurboBridge partners are encouraged to take the code from this repository and embed it into their own web sites.

TurboBridge WebRTC interface is based on SIP-over-WebSockets defined in RFC 7118 (https://tools.ietf.org/html/rfc7118). This interface is compatible with JsSIP (http://jssip.net), sipml5 (http://sipml5.org), and sipjs (http://sipjs.com/). TurboBridge is primarily working with JsSIP for its own reference implementations and testing, but all the other libraries should work as well. If the reference client provided in this repository is not used, and when building independent implementations using SIP-over-WebSocket libraries, TurboBridge recommends not to register with the conferencing service. Registrations will be processed but serve no purpose since TurboBridge never places calls to WebRTC clients.

The reference implementation in this depository is compatible with Chrome on Windows, Linux, and OSX, Firefox on Windows, Linux and OSX, and Chrome on Android. Opera is also supported but have not been extensively tested. IE and Safari are currently not supported.

For production, TurboBridge provides secure Web Socket interface on wss://ws.turbobridge.com. For your development, an un-secure WebSocket interface can be made available to the test platform. Please contact support@turbobridge.com if it is needed.

To support integration with WebRTC and SIP implementations, which provide call results via graphical UI instead of audio feedback, TurboBridge provides a special SIP URL parameter -- direct. If direct parameter is provided in the SIP URL, as in "sip:bridge#123123@turbobridge.com;direct=1", the conference bridge will never issue a re-INVITE. Furthermore it will require a valid conference ID in URL. If conference ID in URL is not provided or if it is invalid, locked, or blocked in any other way, the bridge will immediately return a SIP error message without playing any error announcements. This is the version we recommend to use when integrating TurboBridge service with your web based services. The errors that should be mapped to user error messages are listed below:

* 486 - Conf capacity exceeded
* 406 - Locked
* 404 - No ConfID/PIN found in the URI / Invalid confID
* 430 - Invalid PIN
* 431 - Conf disabled
* 432 - Blocked
* 433 - WebCall Access method is not allowed
* 480 - partner validate error / other failure

If direct parameter is not provided, the call will go through a special WebRTC media forwarding service which will intercept all the re-INVITEs from the bridge. If bridge ID is not provided, the call will be accepted and user will be prompted for bridge ID as on the regular PSTN call. If bridge ID in URL is invalid, the announcement will be played and user will be asked to re-enter it. This option should be used for testing purposes only.

TurboBridge announcements are provided in several different languages, which can be selected via lang URL parameter, as in "sip:bridge#123123@turbobridge.com;direct=1;lang=pt-pt". Supported languages are:
* English (US)  - en-us, en, us
* English (UK)  -  en-gb, uk
* Spanish (Spain) - es-es, sp, es
* French (France) - fr-fr, fr
* German (Germany) - de-de, de
* Italian (Italy)  - it-it, it
* Dutch (Netherlands)  - nl-nl, nl
* Portuguese (Portugal) - pt-pt, pt
* Portuguese (Brazil) - pt-br

WebCall reference implementation in this repository and https://www.turbobridge.com/webcall/, both have a built in debugging mechanism. If you access the site with extra #debug=1 parameter, you will be able to enter the internal web call settings, issue INFO commands manually and to see the decoded call status received via the SIP MESSAGE messages. Furthermore, if debug flag in browser local storage is set to "*" extensive logging information, including sent and received SIP messages, will be written into the JavaScript console log. Please note that JavaScript console logging is disabled by default. 
WebCall also provides the capability to pre-populate the form fields from the URI. So, the, for instance, URL "https://www.turbobridge.com/webcall/#id=123123&name=Joe%20Customer&email=joe@acme.com" will populate Conference ID field to 123123, Name to Joe Customer, and Email to Joe@acme.com. Conference ID, name and email are also stored in the cookie to simplify joining the same conference. When both URL parameters and cookie parameters are present, URL parameters take priority and overwrite cookie values.

This example uses INFO commands to implement conferencing commands such as raise hand, mute, become host, etc. It also passes an additional SIP URL parameter: "sendStatus=MESSAGE", as in  "sip:bridge#123123@turbobridge.com;direct=1;sendStatus=MESSAGE". This causes TurboBridge conferencing service to send SIP MESSAGE messages with current JSON encoded caller status. Client conference mode, mute status etc. are shown to the caller based on those notifications.

Multiple interop issues were discovered and dealt with when developing this example was developed, so we recommend new implementations to start from it. The UI in this example is designed to work on both cell phones and desktop. For something that is embedded into an application you can create a more compact UI.

Finally, we advise you to run the WebCall client on a secure (HTTPS) web site. Please make sure that your users, when accessing this functionality are redirected to HTTPS. Without HTTPS they will not be able to give a persistent microphone access permission. Also, on a non-secure connection, audio device selection will not work in Chrome.
If you have any questions or comments, need test accounts for conferencing service, please do not hesitate to contact support@turbobridge.com.

