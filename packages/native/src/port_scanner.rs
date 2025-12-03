use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::net::{TcpListener, TcpStream, SocketAddr};
use std::time::Duration;

/// Check if a port is available for binding
///
/// # Arguments
/// * `port` - Port number to check (1-65535)
///
/// # Returns
/// * `Result<bool>` - true if port is available, false if in use
///
/// # Example
/// ```
/// let available = is_port_available(3000)?;
/// if available {
///     println!("Port 3000 is available");
/// }
/// ```
#[napi]
pub fn is_port_available(port: u16) -> Result<bool> {
    if port == 0 {
        return Err(Error::new(
            Status::InvalidArg,
            "Port number must be between 1 and 65535",
        ));
    }

    // Try to bind to the port on all interfaces (0.0.0.0)
    let addr = format!("0.0.0.0:{}", port);

    match TcpListener::bind(&addr) {
        Ok(_) => Ok(true),
        Err(_) => {
            // Port is in use or cannot be bound
            // Double-check by trying to connect to it
            let addr = format!("127.0.0.1:{}", port);
            match addr.parse::<SocketAddr>() {
                Ok(socket_addr) => {
                    match TcpStream::connect_timeout(&socket_addr, Duration::from_millis(100)) {
                        Ok(_) => Ok(false), // Successfully connected, port is in use
                        Err(_) => Ok(false), // Connection failed, but binding also failed
                    }
                }
                Err(_) => Ok(false),
            }
        }
    }
}

/// Check if a server is listening on a port by attempting to connect
///
/// # Arguments
/// * `port` - Port number to check (1-65535)
///
/// # Returns
/// * `Result<bool>` - true if a server is listening, false otherwise
///
/// # Example
/// ```
/// let listening = is_port_listening(3000)?;
/// if listening {
///     println!("Server is listening on port 3000");
/// }
/// ```
#[napi]
pub fn is_port_listening(port: u16) -> Result<bool> {
    if port == 0 {
        return Err(Error::new(
            Status::InvalidArg,
            "Port number must be between 1 and 65535",
        ));
    }

    // Try to connect to localhost on the specified port (IPv4 and IPv6)
    let addrs = [
        format!("127.0.0.1:{}", port),      // IPv4 loopback
        format!("[::1]:{}", port),           // IPv6 loopback
        format!("localhost:{}", port),       // DNS resolution fallback
    ];

    for addr_str in &addrs {
        if let Ok(socket_addr) = addr_str.parse::<SocketAddr>() {
            match TcpStream::connect_timeout(&socket_addr, Duration::from_millis(200)) {
                Ok(_) => return Ok(true), // Successfully connected
                Err(_) => continue, // Try next address
            }
        }
    }

    Ok(false) // No connection succeeded
}

/// Find an available port within a specified range
///
/// # Arguments
/// * `start_port` - Starting port number (inclusive)
/// * `end_port` - Ending port number (inclusive)
///
/// # Returns
/// * `Result<u16>` - First available port found, or error if none available
///
/// # Example
/// ```
/// let port = find_available_port(3000, 3100)?;
/// println!("Found available port: {}", port);
/// ```
#[napi]
pub fn find_available_port(start_port: u16, end_port: u16) -> Result<u16> {
    if start_port == 0 || end_port == 0 {
        return Err(Error::new(
            Status::InvalidArg,
            "Port numbers must be between 1 and 65535",
        ));
    }

    if start_port > end_port {
        return Err(Error::new(
            Status::InvalidArg,
            format!(
                "Start port ({}) must be less than or equal to end port ({})",
                start_port, end_port
            ),
        ));
    }

    // Iterate through the port range
    for port in start_port..=end_port {
        let addr = format!("0.0.0.0:{}", port);

        if let Ok(listener) = TcpListener::bind(&addr) {
            // Port is available, drop the listener and return the port
            drop(listener);
            return Ok(port);
        }
    }

    Err(Error::new(
        Status::GenericFailure,
        format!(
            "No available ports found in range {}-{}",
            start_port, end_port
        ),
    ))
}

/// Find multiple available ports within a specified range
///
/// # Arguments
/// * `start_port` - Starting port number (inclusive)
/// * `end_port` - Ending port number (inclusive)
/// * `count` - Number of ports to find
///
/// # Returns
/// * `Result<Vec<u16>>` - Vector of available ports, or error if not enough available
///
/// # Example
/// ```
/// let ports = find_available_ports(3000, 3100, 3)?;
/// println!("Found ports: {:?}", ports);
/// ```
#[napi]
pub fn find_available_ports(start_port: u16, end_port: u16, count: u32) -> Result<Vec<u16>> {
    if start_port == 0 || end_port == 0 {
        return Err(Error::new(
            Status::InvalidArg,
            "Port numbers must be between 1 and 65535",
        ));
    }

    if start_port > end_port {
        return Err(Error::new(
            Status::InvalidArg,
            format!(
                "Start port ({}) must be less than or equal to end port ({})",
                start_port, end_port
            ),
        ));
    }

    if count == 0 {
        return Ok(Vec::new());
    }

    let range_size = (end_port - start_port + 1) as u32;
    if count > range_size {
        return Err(Error::new(
            Status::InvalidArg,
            format!(
                "Requested {} ports but range only contains {} ports",
                count, range_size
            ),
        ));
    }

    let mut available_ports = Vec::new();

    for port in start_port..=end_port {
        if available_ports.len() >= count as usize {
            break;
        }

        let addr = format!("0.0.0.0:{}", port);

        if let Ok(listener) = TcpListener::bind(&addr) {
            drop(listener);
            available_ports.push(port);
        }
    }

    if available_ports.len() < count as usize {
        return Err(Error::new(
            Status::GenericFailure,
            format!(
                "Only found {} available ports, but {} were requested",
                available_ports.len(),
                count
            ),
        ));
    }

    Ok(available_ports)
}

/// Get the default port for common frameworks
///
/// # Arguments
/// * `framework` - Framework name (e.g., "react", "next", "vite")
///
/// # Returns
/// * `Result<u16>` - Default port number for the framework
#[napi]
pub fn get_default_port(framework: String) -> Result<u16> {
    let framework_lower = framework.to_lowercase();

    let default_port = match framework_lower.as_str() {
        "react" | "create-react-app" | "cra" => 3000,
        "next" | "nextjs" | "next.js" => 3000,
        "vite" | "vitejs" => 5173,
        "vue" | "vuejs" => 8080,
        "angular" => 4200,
        "svelte" | "sveltekit" => 5173,
        "nuxt" | "nuxtjs" => 3000,
        "express" => 3000,
        "fastify" => 3000,
        "nest" | "nestjs" => 3000,
        "gatsby" => 8000,
        "remix" => 3000,
        "astro" => 3000,
        _ => {
            return Err(Error::new(
                Status::InvalidArg,
                format!("Unknown framework: {}", framework),
            ));
        }
    };

    Ok(default_port)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_port_available_zero() {
        let result = is_port_available(0);
        assert!(result.is_err());
    }

    #[test]
    fn test_find_available_port_valid_range() {
        // Find a port in a very high range that's likely available
        let result = find_available_port(50000, 50100);
        assert!(result.is_ok());
        if let Ok(port) = result {
            assert!(port >= 50000 && port <= 50100);
        }
    }

    #[test]
    fn test_find_available_port_invalid_range() {
        let result = find_available_port(5000, 4000);
        assert!(result.is_err());
    }

    #[test]
    fn test_find_available_port_zero() {
        let result = find_available_port(0, 100);
        assert!(result.is_err());
    }

    #[test]
    fn test_find_available_ports_valid() {
        let result = find_available_ports(50000, 50100, 3);
        assert!(result.is_ok());
        if let Ok(ports) = result {
            assert_eq!(ports.len(), 3);
        }
    }

    #[test]
    fn test_find_available_ports_too_many() {
        let result = find_available_ports(50000, 50005, 10);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_default_port_react() {
        let result = get_default_port("react".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 3000);
    }

    #[test]
    fn test_get_default_port_vite() {
        let result = get_default_port("vite".to_string());
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 5173);
    }

    #[test]
    fn test_get_default_port_unknown() {
        let result = get_default_port("unknownframework".to_string());
        assert!(result.is_err());
    }
}
