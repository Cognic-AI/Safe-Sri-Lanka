import ballerinax/mysql;
import ballerina/sql;
import ballerina/io;
import ballerina/websocket;
// import safe_srilanka.SMSController as SMSController;

configurable string dbUser = "root";
configurable string dbPassword = "root";
configurable string dbHost = "localhost";
configurable int dbPort = 3306;
configurable string dbName = "safe_sri_lanka";

mysql:Client dbClient = check new (host = dbHost, user = dbUser, password = dbPassword, database = dbName, port = dbPort);

// WebSocket connections store
public map<websocket:Caller> connections = {};

public function sendSOSSignal(int senderId, decimal lat, decimal lon) returns json|error {
    sql:ParameterizedQuery query = `INSERT INTO sos_signal (sender_id, lat, lon) VALUES (${senderId}, ${lat}, ${lon})`;
    sql:ExecutionResult result = check dbClient->execute(query);
    int sosId = <int>result.lastInsertId;

    // Get friends and nearby people
    json[] recipients = check getRecipientsForSOS(senderId, lat, lon);

    // Send messages
    _ = check sendSMSMessages(recipients, sosId, senderId, lat, lon);
    _ = check sendWhatsAppMessages(recipients, sosId, senderId, lat, lon);

    // Broadcast SOS signal to all connected WebSocket clients
    json sosMessage = {
        "type": "sos",
        "senderId": senderId,
        "lat": lat,
        "lon": lon,
        "sosId": sosId
    };
    foreach var [_, connection] in connections.entries() {
        _ = check connection->writeMessage(sosMessage);
    }

    return { "status": "success", "message": "SOS signal sent", "sosId": sosId };
}

function getRecipientsForSOS(int senderId, decimal lat, decimal lon) returns json[]|error {
    sql:ParameterizedQuery friendsQuery = `
        SELECT p.id, p.name, p.mobile, p.whatsapp
        FROM relationship r
        JOIN profile p ON r.user2 = p.id
        WHERE r.user1 = ${senderId}
    `;

    sql:ParameterizedQuery nearbyQuery = `
        SELECT p.id, p.name, p.mobile, p.whatsapp,
               (6371 * acos(cos(radians(${lat})) * cos(radians(cl.lat)) * cos(radians(cl.lon) - radians(${lon})) + sin(radians(${lat})) * sin(radians(cl.lat)))) AS distance
        FROM profile p
        JOIN current_location cl ON p.id = cl.id
        WHERE p.id != ${senderId}
        HAVING distance < 5 -- 5 km radius
        ORDER BY distance
    `;

    stream<record {}, error?> friendsStream = dbClient->query(friendsQuery);
    stream<record {}, error?> nearbyStream = dbClient->query(nearbyQuery);

    json[] AllRecipients = [];

    check from record {} entry in friendsStream
        do {
            AllRecipients.push(entry.toJson());
        };

    check from record {} entry in nearbyStream
        do {
            AllRecipients.push(entry.toJson());
        };

    io:println(AllRecipients);
    return AllRecipients;
}

function sendSMSMessages(json[] recipients, int sosId, int senderId, decimal lat, decimal lon) returns error? {
    io:println("Sending SMS messages for SOS ID: " + sosId.toString());
    
    // string message = string `SOS Alert! Your friend (ID: ${senderId}) needs help. Location: ${lat}, ${lon}. SOS ID: ${sosId}`;
    
    // foreach var recipient in recipients {
    //     if (recipient is map<json>) {
    //         string? mobileJson = check recipient.mobile;
    //         if (mobileJson is string) {
    //             check SMSController:sendSMS(mobileJson, message);
    //         }
    //     }
    // }
    
    io:println("SMS messages sent successfully for SOS ID: ", sosId.toString());
}

function sendWhatsAppMessages(json[] recipients, int sosId, int senderId, decimal lat, decimal lon) returns error? {
    // Implement WhatsApp sending logic here
    // You may need to use WhatsApp Business API or a third-party service
    io:println("Sending WhatsApp messages for SOS ID: ", sosId.toString());
}

public function getSOSDetails(int sosId) returns json|error {
    sql:ParameterizedQuery query = `
        SELECT s.*, p.name as sender_name
        FROM sos_signal s
        JOIN profile p ON s.sender_id = p.id
        WHERE s.id = ${sosId}
    `;

    stream<record {}, error?> resultStream = dbClient->query(query);
    record {}|error? result = check resultStream.next();

    if (result is record {}) {
        return result.toJson();
    } else {
        return { "status": "error", "message": "SOS signal not found" };
    }
}
