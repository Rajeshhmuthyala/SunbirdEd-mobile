import { Injectable } from "@angular/core";
import { Platform } from "ionic-angular";
import { HTTP } from "@ionic-native/http";
import { Session } from "./session";

@Injectable()
export class OAuthService {

    redirect_url = "https://dev.open-sunbird.org/oauth2callback";

    auth_url= "https://dev.open-sunbird.org/auth/realms/" + 
    "sunbird/protocol/openid-connect/auth?redirect_uri=${R}" + 
    "&response_type=code&scope=offline_access&client_id=${CID}";

    constructor(private platform: Platform, private http: HTTP, private session: Session) {
        this.auth_url = this.auth_url.replace("${CID}", this.platform.is("android")?"android":"ios");
        this.auth_url = this.auth_url.replace("${R}", this.redirect_url);
    }

    doOAuthStepOne(): Promise<any> {
        let that = this;
        return new Promise(function(resolve, reject) {
            let browserRef = (<any>window).cordova.InAppBrowser.open(that.auth_url);
            browserRef.addEventListener("loadstart", (event) => {
                if ((event.url).indexOf(that.redirect_url) === 0) {
                    browserRef.removeEventListener("exit", (event) => {});
                    browserRef.close();
                    let responseParameters = ((event.url).split("?")[1]);
                    if (responseParameters !== undefined) {
                        resolve(responseParameters);
                    } else {
                        reject("Problem authenticating with Sunbird");
                    }
                }
            });
            browserRef.addEventListener("exit", function(event) {
                reject("The Sunbird sign in flow was canceled");
            });
        });
    }

    doOAuthStepTwo(token: string): Promise<any> {

        let that = this;

        return new Promise(function(resolve, reject) {
            let body = "redirect_uri=https%3A%2F%2F" + 
            "https://staging.open-sunbird.org" + "%2Foauth2callback&code=" + token + 
            "&grant_type=authorization_code&client_id=android";
            let contentType = "application/x-www-form-urlencoded";
            let url = "https://staging.open-sunbird.org/auth/realms/sunbird/protocol/openid-connect/token";

            that.http.post(
                url, 
                body, 
                { headers: { 'Content-Type': contentType }}
            )
            .then(data => {
                try {
                    let refreshToken = data["refresh_token"];
                
                    let accessToken: string = data["access_token"];

                    let value = accessToken.substring(accessToken.indexOf('.'), accessToken.lastIndexOf('.'));
                    value = atob(value);
                    let json = JSON.parse(value);
                    let userToken = json["sub"];

                    that.session.createSession(userToken, accessToken, refreshToken);

                    resolve();
                    
                } catch (error) {
                    reject(error);
                }
            })
            .catch(e => {
                reject(e);
            });
            
        });
    }

}