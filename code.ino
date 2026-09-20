#include <Servo.h>

Servo servo;

void setup() {
    Serial.begin(9600);

    // Let React know the Arduino is ready
    Serial.println("READY");
}

void loop() {
    // Check if React sent us a command
    if (Serial.available()) {
        String command = Serial.readStringUntil('\n');
        command.trim();

        handleCommand(command);
    }
}

void handleCommand(String command) {

    // -------------------------
    // BLINK pin delay
    // Example: BLINK 13 500
    // -------------------------
    if (command.startsWith("BLINK")) {

        int firstSpace = command.indexOf(' ');
        int secondSpace = command.indexOf(' ', firstSpace + 1);

        int pin = command.substring(
            firstSpace + 1,
            secondSpace
        ).toInt();

        int delayTime = command.substring(
            secondSpace + 1
        ).toInt();

        pinMode(pin, OUTPUT);

        digitalWrite(pin, HIGH);
        delay(delayTime);

        digitalWrite(pin, LOW);
        delay(delayTime);
    }

    // -------------------------
    // LED pin ON/OFF
    // Example: LED 13 ON
    // -------------------------
    else if (command.startsWith("LED")) {

        int firstSpace = command.indexOf(' ');
        int secondSpace = command.indexOf(' ', firstSpace + 1);

        int pin = command.substring(
            firstSpace + 1,
            secondSpace
        ).toInt();

        String state = command.substring(
            secondSpace + 1
        );

        pinMode(pin, OUTPUT);

        if (state == "ON") {
            digitalWrite(pin, HIGH);
        }
        else if (state == "OFF") {
            digitalWrite(pin, LOW);
        }
    }

    // -------------------------
    // SERVO pin angle
    // Example: SERVO 9 90
    // -------------------------
    else if (command.startsWith("SERVO")) {

        int firstSpace = command.indexOf(' ');
        int secondSpace = command.indexOf(' ', firstSpace + 1);

        int pin = command.substring(
            firstSpace + 1,
            secondSpace
        ).toInt();

        int angle = command.substring(
            secondSpace + 1
        ).toInt();

        servo.attach(pin);
        servo.write(angle);
    }

    else if (command.startsWith("HELLO")) {

        Serial.println("WORLD");
    }

    // Tell React we finished
    Serial.println("DONE");
}