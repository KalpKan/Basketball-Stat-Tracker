import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("Hoops Analytics")
                .font(.largeTitle.bold())
            Text("iPhone capture and shot analytics")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
        .background(Color.black)
        .foregroundStyle(.white)
    }
}

